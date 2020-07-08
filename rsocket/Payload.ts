import {encode, decode} from "../deps.ts"

export class Payload {
    private _data?: Uint8Array | undefined;
    private _metadata?: Uint8Array | undefined

    constructor(data?: Uint8Array | undefined, metadata?: Uint8Array | undefined) {
        this._data = data;
        this._metadata = metadata;
    }

    get data(): Uint8Array | undefined {
        return this._data;
    }

    set data(value: Uint8Array | undefined) {
        this._data = value;
    }

    get metadata(): Uint8Array | undefined {
        return this._metadata;
    }

    set metadata(value: Uint8Array | undefined) {
        this._metadata = value;
    }

    getMetadataUtf8(): string | undefined {
        if (this._metadata) {
            return decode(this._metadata);
        }
        return undefined;
    }

    getDataUtf8(): string | undefined {
        if (this._data) {
            return decode(this._data);
        }
        return undefined;
    }

    public static fromText(data: string, metadata: string): Payload {
        return new Payload(encode(data), encode(metadata));
    }
}

export class ConnectionSetupPayload extends Payload {
    private readonly _metadataMimeType: string;
    private readonly _dataMimeType: string;
    private readonly _keepAliveInterval: number = 20;
    private readonly _keepAliveMaxLifetime: number = 90;
    private readonly _flags: number = 0;


    constructor(keepAliveInterval: number, keepAliveMaxLifetime: number, flags: number, metadataMimeType: string, dataMimeType: string) {
        super(undefined, undefined);
        this._keepAliveInterval = keepAliveInterval;
        this._keepAliveMaxLifetime = keepAliveMaxLifetime;
        this._flags = flags;
        this._metadataMimeType = metadataMimeType;
        this._dataMimeType = dataMimeType;
    }

    get metadataMimeType(): string {
        return this._metadataMimeType;
    }

    get dataMimeType(): string {
        return this._dataMimeType;
    }

    get keepAliveInterval(): number {
        return this._keepAliveInterval;
    }

    get keepAliveMaxLifetime(): number {
        return this._keepAliveMaxLifetime;
    }

    get flags(): number {
        return this._flags;
    }
}
