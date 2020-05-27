import {ByteBuffer} from "../io/ByteBuffer.ts";
import {encode, decode} from "./../../deps.ts";
import {
    WellKnownMimeType,
    MESSAGE_RSOCKET_ROUTING,
    MESSAGE_RSOCKET_AUTHENTICATION,
    MESSAGE_RSOCKET_MIMETYPE,
    MESSAGE_RSOCKET_ACCEPT_MIMETYPES,
    MESSAGE_RSOCKET_TRACING_ZIPKIN

} from "./WellKnownMimeType.ts";

export class CompositeMetadata {
    _buffer: ByteBuffer;
    _map: Map<string, MetadataEntry> | undefined

    constructor(buffer: ByteBuffer) {
        this._buffer = buffer;
    }

    public static create() {
        return new CompositeMetadata(ByteBuffer.alloc(0));
    }

    public static fromEntries(...entries: MetadataEntry[]) {
        let compositeMetadata = new CompositeMetadata(ByteBuffer.alloc(0));
        for (const entry of entries) {
            compositeMetadata.addMetadata(entry);
        }
        return compositeMetadata;
    }

    public static fromU8Array(u8Array: Uint8Array) {
        return new CompositeMetadata(ByteBuffer.fromUint8Array(u8Array));
    }

    public addMetadata(metadata: MetadataEntry) {
        if (WellKnownMimeType.isWellKnowMimeType(metadata.getMimeType())) {
            this.addWellKnownMimeType(WellKnownMimeType.fromString(metadata.getMimeType()).identifier, metadata.getContent());
        } else {
            this.addExplicitMimeType(metadata.getMimeType(), metadata.getContent());
        }
    }

    public addWellKnownMimeType(typeId: number, content: Uint8Array) {
        this._buffer.writeI8(typeId | 0x80);
        this._buffer.writeI24(content.length);
        this._buffer.writeUint8Array(content);
    }

    public addExplicitMimeType(mimeType: string, content: Uint8Array) {
        if (WellKnownMimeType.isWellKnowMimeType(mimeType)) {
            this.addWellKnownMimeType(WellKnownMimeType.fromString(mimeType).identifier, content);
        } else {
            let mimeTypeArray = encode(mimeType);
            this._buffer.writeI8(mimeTypeArray.length);
            this._buffer.writeUint8Array(mimeTypeArray)
            this._buffer.writeI24(content.length);
            this._buffer.writeUint8Array(content);
        }
    }

    public toUint8Array(): Uint8Array {
        return this._buffer.toUint8Array();
    }

    [Symbol.iterator]() {
        this._buffer.resetReaderIndex();
        return this.entriesIterator(this._buffer);
    }

    * entriesIterator(buffer: ByteBuffer): Iterator<MetadataEntry> {
        while (buffer.isReadable()) {
            let metadataTypeOrLength = buffer.readI8();
            if (metadataTypeOrLength) {
                if ((metadataTypeOrLength >= 0x80)) {
                    let typeId = metadataTypeOrLength - 0x80;
                    let wellKnownMimeType = WellKnownMimeType.fromIdentifier(typeId);
                    let dataLength = buffer.readI24();
                    if (dataLength) {
                        let content = buffer.readUint8Array(dataLength);
                        if (content) {
                            yield new WellKnownMimeTypeEntry(content, wellKnownMimeType)
                        }
                    }
                } else {
                    let mimeTypeU8Array = buffer.readUint8Array(metadataTypeOrLength);
                    if (mimeTypeU8Array) {
                        let dataLength = buffer.readI24();
                        if (dataLength) {
                            let content = buffer.readUint8Array(dataLength);
                            if (content) {
                                let mimeType = decode(mimeTypeU8Array);
                                yield new ExplicitMimeTypeEntry(content, mimeType)
                            }
                        }
                    }
                }
            }
        }
    }

    public findEntry(type: string): MetadataEntry | undefined {
        if (this._map == undefined) {
            this._map = new Map<string, MetadataEntry>()
            for (const entry of this) {
                this._map.set(entry.getMimeType(), entry)
            }
        }
        return this._map.get(type);
    }
}

export interface MetadataEntry {
    /**
     * Returns the un-decoded content of the {@link MetadataEntry}.
     *
     * @return the un-decoded content of the {@link MetadataEntry}
     */
    getContent(): Uint8Array;

    /**
     * Returns the MIME type of the entry, if it can be decoded.
     *
     * @return the MIME type of the entry, if it can be decoded, otherwise {@code null}.
     */
    getMimeType(): string,
}

export class ExplicitMimeTypeEntry implements MetadataEntry {
    _content: Uint8Array;
    _type: string;

    constructor(content: Uint8Array, type: string) {
        this._content = content;
        this._type = type;
    }

    getContent(): Uint8Array {
        return this._content;
    }

    getMimeType(): string {
        return this._type;
    }

}

export class WellKnownMimeTypeEntry implements MetadataEntry {
    _content: Uint8Array;
    _type: WellKnownMimeType;

    constructor(content: Uint8Array, type: WellKnownMimeType) {
        this._content = content;
        this._type = type;
    }

    getContent(): Uint8Array {
        return this._content;
    }

    getMimeType(): string {
        return this._type.string;
    }


    /**
     * Returns the {@link WellKnownMimeType} for this entry.
     *
     * @return the {@link WellKnownMimeType} for this entry
     */
    get type(): WellKnownMimeType {
        return this._type;
    }
}

export class ReservedMimeTypeEntry implements MetadataEntry {
    _content: Uint8Array;
    _type: number;

    constructor(content: Uint8Array, type: number) {
        this._content = content;
        this._type = type;
    }

    getContent(): Uint8Array {
        return this._content;
    }

    getMimeType(): string {
        return "";
    }


}

export class TaggingMetadata implements MetadataEntry {
    mimeType: string;
    tags: string[]

    constructor(mimeType: string, tags: string[]) {
        this.mimeType = mimeType;
        this.tags = tags;
    }

    getContent(): Uint8Array {
        let buffer = ByteBuffer.alloc(this.tags.length * 2)
        for (const tag of this.tags) {
            let tagU8Array = encode(tag);
            if (tagU8Array.length <= 0xFF) {
                buffer.writeI8(tagU8Array.length);
                buffer.writeUint8Array(tagU8Array);
            }
        }
        return buffer.toUint8Array();
    }

    getMimeType(): string {
        return this.mimeType;
    }

    public static fromEntry(entry: MetadataEntry): TaggingMetadata {
        let buffer = ByteBuffer.fromUint8Array(entry.getContent());
        let tags: string[] = [];
        while (buffer.isReadable()) {
            let tagLength = buffer.readI8();
            if (tagLength) {
                let u8Array = buffer.readUint8Array(tagLength);
                if (u8Array) {
                    tags[tags.length] = decode(u8Array)
                }
            }
        }
        return new TaggingMetadata(entry.getMimeType(), tags)
    }
}

export class RoutingMetadata extends TaggingMetadata {
    routingKey: string;
    extraTags?: string[];

    constructor(routingKey: string, extraTags?: string[]) {
        let tags = [routingKey]
        if (extraTags) {
            tags.push(...extraTags)
        }
        super(MESSAGE_RSOCKET_ROUTING.string, tags);
        this.routingKey = routingKey;
        this.extraTags = extraTags;
    }

    public static fromEntry(entry: MetadataEntry): RoutingMetadata {
        let taggingMetadata = TaggingMetadata.fromEntry(entry);
        let tags = taggingMetadata.tags;
        if (tags.length == 0) {
            return new RoutingMetadata(tags[0])
        } else {
            return new RoutingMetadata(tags[0], tags.slice(1, tags.length))
        }
    }
}

export class AuthMetadata implements MetadataEntry {
    authData: Uint8Array;
    mimeType: string;
    authTypeId: number;

    constructor(authTypeId: number, authData: Uint8Array) {
        this.mimeType = MESSAGE_RSOCKET_AUTHENTICATION.string;
        this.authTypeId = authTypeId;
        this.authData = authData;
    }

    getContent(): Uint8Array {
        let content = new Uint8Array(this.authData.length + 1);
        content[0] = 0x80 | this.authTypeId;
        content.set(content, 1);
        return content;
    }

    getMimeType(): string {
        return this.mimeType;
    }

    public static jwt(jwtToken: string): AuthMetadata {
        return new AuthMetadata(0x01, encode(jwtToken))
    }

    public static simple(username: string, password: string): AuthMetadata {
        let userNameU8Array = encode(username);
        let passwordU8Array = encode(password);
        let buffer = ByteBuffer.alloc(3 + userNameU8Array.length + passwordU8Array.length);
        buffer.writeI24(userNameU8Array.length);
        buffer.writeUint8Array(userNameU8Array);
        buffer.writeUint8Array(passwordU8Array);
        return new AuthMetadata(0x00, buffer.toUint8Array());
    }
}

export class MessageMimeTypeMetadata implements MetadataEntry {
    mimeType: string;
    dataMimeType: string;

    constructor(dataMimeType: string) {
        this.mimeType = MESSAGE_RSOCKET_MIMETYPE.string;
        this.dataMimeType = dataMimeType;

    }

    getContent(): Uint8Array {
        if (WellKnownMimeType.isWellKnowMimeType(this.dataMimeType)) {
            let content = new Uint8Array(1)
            content[0] = 0x80 | WellKnownMimeType.fromString(this.dataMimeType).identifier
            return content;
        } else {
            let dataMimeTypeU8Array = encode(this.dataMimeType);
            let content = new Uint8Array(1 + dataMimeTypeU8Array.length)
            content[0] = dataMimeTypeU8Array.length;
            content.set(dataMimeTypeU8Array, 1);
            return content;
        }
    }

    getMimeType(): string {
        return this.mimeType;
    }


}

export class MessageAcceptMimeTypesMetadata implements MetadataEntry {
    mimeType: string;
    acceptMimeTypes: string[]

    constructor(acceptMimeTypes: string[]) {
        this.mimeType = MESSAGE_RSOCKET_ACCEPT_MIMETYPES.string;
        this.acceptMimeTypes = acceptMimeTypes;

    }

    getContent(): Uint8Array {
        let buffer = ByteBuffer.alloc(this.acceptMimeTypes.length * 2)
        for (const acceptMimeType of this.acceptMimeTypes) {
            if (WellKnownMimeType.isWellKnowMimeType(acceptMimeType)) {
                buffer.writeI8(0x80 | WellKnownMimeType.fromString(acceptMimeType).identifier)
            } else {
                let acceptMimeTypeU8Array = encode(acceptMimeType);
                buffer.writeI8(acceptMimeTypeU8Array.length);
                buffer.writeUint8Array(acceptMimeTypeU8Array)
            }
        }
        return buffer.toUint8Array();
    }

    getMimeType(): string {
        return this.mimeType;
    }


}

export class ZipkinTracingMetadata implements MetadataEntry {
    mimeType: string;
    flags: number;
    spanId: number;
    traceIdHigh: number | undefined;
    traceIdLow: number;
    parentId: number | undefined


    constructor(flags: number, spanId: number, traceIdHigh: number | undefined, traceIdLow: number, parentId: number | undefined) {
        this.mimeType = MESSAGE_RSOCKET_TRACING_ZIPKIN.string;
        this.flags = flags;
        this.spanId = spanId;
        this.traceIdHigh = traceIdHigh;
        this.traceIdLow = traceIdLow;
        this.parentId = parentId;

    }

    getContent(): Uint8Array {
        let buffer = ByteBuffer.alloc(9);
        buffer.writeI8(this.flags);
        if (this.traceIdHigh) {
            buffer.writeI64(this.traceIdHigh)
        }
        buffer.writeI64(this.traceIdLow)
        buffer.writeI64(this.spanId);
        if (this.parentId) {
            buffer.writeI64(this.parentId);
        }
        return buffer.toUint8Array();
    }

    getMimeType(): string {
        return this.mimeType;
    }

    public static trace(spanId: number, traceIdHigh: number | undefined, traceIdLow: number, parentId: number | undefined): ZipkinTracingMetadata {
        let flags = 0;
        if (parentId) {
            flags = flags | 0x01;
        }
        if (traceIdHigh) {
            flags = flags | 0x02;
        }
        return new ZipkinTracingMetadata(flags, spanId, traceIdHigh, traceIdLow, parentId);
    }

}

