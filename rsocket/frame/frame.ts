import {ByteBuffer} from "../io/ByteBuffer.ts";
import {Payload} from "../Payload.ts";
import {decode, encode} from "../../deps.ts"

const MAJOR_VERSION = 1
const MINOR_VERSION = 0

const EMPTY_U8_ARRAY = new Uint8Array(0);

export enum FrameType {
    RESERVED = 0x00,
    SETUP = 0x01,
    LEASE = 0x02,
    KEEPALIVE = 0x03,
    REQUEST_RESPONSE = 0x04,
    REQUEST_FNF = 0x05,
    REQUEST_STREAM = 0x06,
    REQUEST_CHANNEL = 0x07,
    REQUEST_N = 0x08,
    CANCEL = 0x09,
    PAYLOAD = 0x0A,
    ERROR = 0x0B,
    METADATA_PUSH = 0x0C,
    RESUME = 0x0D,
    RESUME_OK = 0x0E,
    EXT = 0x3F
}

//========== decode ==============

export class RSocketHeader {
    frameLength = 0;
    streamId = 0;
    type = 0;
    flags = 0
    metaPresent = false

    constructor(buffer: ByteBuffer) {
        let frameLength = buffer.readI24();
        if (frameLength) {
            this.frameLength = frameLength;
        }
        let streamId = buffer.readI32();
        if (streamId) {
            this.streamId = streamId;
        }
        let frameTypeByte = buffer.readI8();
        if (frameTypeByte != undefined) {
            this.type = frameTypeByte >> 2;
            this.metaPresent = (frameTypeByte & 0x01) == 1;
        }
        let flags = buffer.readI8();
        if (flags) {
            this.flags = flags;
        }
    }

}

export class SetupFrame {
    header: RSocketHeader;
    payload?: Payload;
    metadataMimeType = "message/x.rsocket.composite-metadata.v0";
    dataMimeType = "application/octet-stream";
    keepAliveInterval = 20;
    keepAliveMaxLifetime = 90;
    resumeToken?: string
    leaseEnable: boolean

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        let resumeEnable = (header.flags & 0x80) > 0;
        this.leaseEnable = (header.flags & 0x40) > 0;
        let majorVersion = buffer.readI16();
        let minorVersion = buffer.readI16();
        let keepAliveInterval = buffer.readI32();
        if (keepAliveInterval) {
            this.keepAliveInterval = keepAliveInterval;
        }
        let keepAliveMaxLifetime = buffer.readI32();
        if (keepAliveMaxLifetime) {
            this.keepAliveMaxLifetime = keepAliveMaxLifetime;
        }
        //resume token extraction
        if (resumeEnable) {
            let resumeTokenLength = buffer.readI16();
            if (resumeTokenLength) {
                let tokenU8Array = buffer.readUint8Array(resumeTokenLength);
                if (tokenU8Array) {
                    this.resumeToken = decode(tokenU8Array);
                }
            }
        }
        // metadata & data encoding
        let metadataMimeTypeLength = buffer.readI8();
        if (metadataMimeTypeLength) {
            let metadataMimeTypeU8Array = buffer.readUint8Array(metadataMimeTypeLength);
            if (metadataMimeTypeU8Array) {
                this.metadataMimeType = decode(metadataMimeTypeU8Array);
            }
        }
        let dataMimeTypeLength = buffer.readI8();
        if (dataMimeTypeLength) {
            let dataMimeTypeU8Array = buffer.readUint8Array(dataMimeTypeLength);
            if (dataMimeTypeU8Array) {
                this.dataMimeType = decode(dataMimeTypeU8Array);
            }
        }
        this.payload = decodePayload(buffer, header.metaPresent, header.frameLength);
    }
}

export class LeaseFrame {
    header: RSocketHeader;
    timeToLive = 0;
    numberOfRequests = 0;
    payload?: Payload

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        this.timeToLive = 0;
        let timeToLive = buffer.readI32();
        if (timeToLive) {
            this.timeToLive = timeToLive;
        }
        let numberOfRequests = buffer.readI32();
        if (numberOfRequests) {
            this.numberOfRequests = numberOfRequests;
        }
    }
}

export class KeepAliveFrame {
    header: RSocketHeader;
    lastReceivedPosition = 0;
    payload?: Payload
    respond = false;

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        let lastReceivedPosition = buffer.readI32();
        if (lastReceivedPosition) {
            this.lastReceivedPosition = lastReceivedPosition;
        }
        if (header && header.frameLength) {
            this.payload = decodePayload(buffer, header.metaPresent, header.frameLength);
        }
        this.respond = (header.flags & 0x80) > 0;
    }
}

export class RequestResponseFrame {
    header: RSocketHeader;
    payload?: Payload

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        if (header && header.frameLength) {
            this.payload = decodePayload(buffer, header.metaPresent, header.frameLength);
        }
    }
}

export class RequestFNFFrame {
    header: RSocketHeader;
    payload?: Payload

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        if (header && header.frameLength) {
            this.payload = decodePayload(buffer, header.metaPresent, header.frameLength);
        }
    }
}

export class RequestStreamFrame {
    header: RSocketHeader;
    initialRequestN: number | undefined;
    payload?: Payload

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        this.initialRequestN = buffer.readI32();
        if (header && header.frameLength) {
            this.payload = decodePayload(buffer, header.metaPresent, header.frameLength);
        }
    }
}

export class RequestChannelFrame {
    header: RSocketHeader;
    initialRequestN: number | undefined;
    payload?: Payload

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        this.initialRequestN = buffer.readI32();
        if (header && header.frameLength) {
            this.payload = decodePayload(buffer, header.metaPresent, header.frameLength);
        }
    }
}

export class RequestNFrame {
    header: RSocketHeader;
    initialRequestN: number | undefined

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        this.initialRequestN = buffer.readI32();
    }
}

export class CancelFrame {
    header: RSocketHeader;

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
    }
}

export class PayloadFrame {
    header: RSocketHeader;
    payload?: Payload
    completed = false;

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        this.completed = (header.flags & 0x40) > 0;
        if (header && header.frameLength) {
            this.payload = decodePayload(buffer, header.metaPresent, header.frameLength);
        }
    }
}

export class ErrorFrame {
    header: RSocketHeader;
    code = 0;
    message = ""

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        let errorCode = buffer.readI32();
        if (errorCode) {
            this.code = errorCode;
        }
        let dataLength = header.frameLength - 10;
        if (dataLength > 0) {
            let u8Array = buffer.readUint8Array(dataLength);
            if (u8Array) {
                this.message = decode(u8Array);
            }
        }
    }
}

export class MetadataPushFrame {
    header: RSocketHeader;
    payload?: Payload

    constructor(header: RSocketHeader, buffer: ByteBuffer) {
        this.header = header;
        if (header && header.frameLength) {
            this.payload = decodePayload(buffer, header.metaPresent, header.frameLength);
        }
    }
}

export function* parseFrames(chunk: Uint8Array) {
    let byteBuffer = ByteBuffer.fromUint8Array(chunk);
    while (byteBuffer.isReadable()) {
        let header = new RSocketHeader(byteBuffer);
        switch (header.type) {
            case FrameType.SETUP: {
                yield new SetupFrame(header, byteBuffer);
                break;
            }
            case FrameType.LEASE: {
                yield new LeaseFrame(header, byteBuffer);
                break;
            }
            case FrameType.KEEPALIVE: {
                yield new KeepAliveFrame(header, byteBuffer);
                break;
            }
            case FrameType.REQUEST_RESPONSE: {
                yield new RequestResponseFrame(header, byteBuffer);
                break;
            }
            case FrameType.REQUEST_FNF: {
                yield new RequestFNFFrame(header, byteBuffer);
                break;
            }
            case FrameType.REQUEST_STREAM: {
                yield new RequestStreamFrame(header, byteBuffer);
                break;
            }
            case FrameType.REQUEST_CHANNEL: {
                yield new RequestChannelFrame(header, byteBuffer);
                break;
            }
            case FrameType.REQUEST_N: {
                yield new RequestNFrame(header, byteBuffer);
                break;
            }
            case FrameType.CANCEL: {
                yield new CancelFrame(header, byteBuffer);
                break;
            }
            case FrameType.PAYLOAD: {
                yield new PayloadFrame(header, byteBuffer);
                break;
            }
            case FrameType.ERROR : {
                yield new ErrorFrame(header, byteBuffer);
                break;
            }
            default: {
                if (header.frameLength && header.frameLength > 9) {
                    byteBuffer.readBytes(header.frameLength - 9)
                }
                break;
            }
        }
    }
}

function decodePayload(buffer: ByteBuffer, metadataPresent: boolean, frameLength: number): Payload {
    let payload = new Payload();
    let dataLength = frameLength - 6;
    if (metadataPresent) {
        let metadataLength = buffer.readI24();
        if (metadataLength != undefined) {
            dataLength = dataLength - 3 - metadataLength;
            if (metadataLength > 0) {
                payload.metadata = buffer.readUint8Array(metadataLength);
            }
        }
    }
    if (dataLength > 0) {
        payload.data = buffer.readUint8Array(dataLength);
    }
    return payload;
}

//=============== encode ========================
export function encodeSetupFrame(
    keepaliveInterval: number,
    maxLifetime: number,
    metadataMimeType: string,
    dataMimeType: string,
    setupPayload?: Payload
): Uint8Array {
    let frameBuffer = ByteBuffer.alloc(21);
    frameBuffer.writeI24(0) // frame length
    frameBuffer.writeI32(0); //stream id
    //frame type with metadata indicator without resume token and lease
    writeTFrameTypeAndFlags(frameBuffer, FrameType.SETUP, setupPayload?.metadata, 0)
    frameBuffer.writeI16(MAJOR_VERSION);
    frameBuffer.writeI16(MINOR_VERSION);
    frameBuffer.writeI32(keepaliveInterval);
    frameBuffer.writeI32(maxLifetime);
    //Metadata Encoding MIME Type
    frameBuffer.writeI8(metadataMimeType.length)
    frameBuffer.writeUint8Array(encode(metadataMimeType))
    //Data Encoding MIME Type
    frameBuffer.writeI8(dataMimeType.length);
    frameBuffer.writeUint8Array(encode(dataMimeType))
    // Metadata & Setup Payload
    writePayload(frameBuffer, setupPayload)
    // refill frame length
    refillFrameLength(frameBuffer);
    return frameBuffer.toUint8Array();
}

//todo add LEASE encode


export function encodeKeepAlive(respond: boolean, lastPosition: number): Uint8Array {
    let frameBuffer = ByteBuffer.alloc(17);
    frameBuffer.writeI24(0) // frame length
    frameBuffer.writeI32(0) //stream id
    frameBuffer.writeI8(FrameType.KEEPALIVE << 2)
    if (respond) {
        frameBuffer.writeI8(0x80)
    } else {
        frameBuffer.writeI8(0);
    }
    frameBuffer.writeI64(lastPosition);
    refillFrameLength(frameBuffer);
    return frameBuffer.toUint8Array();
}

export function encodeRequestResponseFrame(
    streamId: number,
    payload: Payload
): Uint8Array {
    let frameBuffer = ByteBuffer.alloc(9);
    frameBuffer.writeI24(0) // frame length
    frameBuffer.writeI32(streamId); //stream id
    writeTFrameTypeAndFlags(frameBuffer, FrameType.REQUEST_RESPONSE, payload.metadata, 0)
    writePayload(frameBuffer, payload);
    refillFrameLength(frameBuffer);
    return frameBuffer.toUint8Array();
}

export function encodeRequestFNFFrame(
    streamId: number,
    payload: Payload
): Uint8Array {
    let frameBuffer = ByteBuffer.alloc(9);
    frameBuffer.writeI24(0) // frame length
    frameBuffer.writeI32(streamId); //stream id
    writeTFrameTypeAndFlags(frameBuffer, FrameType.REQUEST_FNF, payload.metadata, 0)
    writePayload(frameBuffer, payload);
    refillFrameLength(frameBuffer);
    return frameBuffer.toUint8Array();
}

export function encodeRequestStreamFrame(
    streamId: number,
    initialRequestN: number,
    payload: Payload
): Uint8Array {
    let frameBuffer = ByteBuffer.alloc(13);
    frameBuffer.writeI24(0) // frame length
    frameBuffer.writeI32(streamId); //stream id
    writeTFrameTypeAndFlags(frameBuffer, FrameType.REQUEST_STREAM, payload.metadata, 0)
    frameBuffer.writeI32(initialRequestN);
    writePayload(frameBuffer, payload);
    refillFrameLength(frameBuffer);
    return frameBuffer.toUint8Array();
}

export function encodeRequestChannelFrame(
    streamId: number,
    complete: boolean,
    initialRequestN: number,
    payload?: Payload
): Uint8Array {
    let frameBuffer = ByteBuffer.alloc(13);
    frameBuffer.writeI24(0) // frame length
    frameBuffer.writeI32(streamId); //stream id
    let flags = 0;
    if (complete) {
        flags = 0x40;
    }
    if (payload) {
        writeTFrameTypeAndFlags(frameBuffer, FrameType.REQUEST_CHANNEL, payload.metadata, flags);
        frameBuffer.writeI32(initialRequestN);
        writePayload(frameBuffer, payload);
    } else {
        writeTFrameTypeAndFlags(frameBuffer, FrameType.REQUEST_CHANNEL, undefined, flags);
        frameBuffer.writeI32(initialRequestN);
    }
    refillFrameLength(frameBuffer);
    return frameBuffer.toUint8Array();
}

export function encodeRequestNFrame(
    streamId: number,
    requestN: number
): Uint8Array {
    let frameBuffer = ByteBuffer.alloc(13);
    frameBuffer.writeI24(0) // frame length
    frameBuffer.writeI32(streamId); //stream id
    frameBuffer.writeI8(FrameType.REQUEST_N << 2)
    frameBuffer.writeI8(0);
    frameBuffer.writeI32(requestN);
    refillFrameLength(frameBuffer);
    return frameBuffer.toUint8Array();
}

export function encodeCancelFrame(
    streamId: number
): Uint8Array {
    let frameBuffer = ByteBuffer.alloc(9);
    frameBuffer.writeI24(0) // frame length
    frameBuffer.writeI32(streamId); //stream id
    frameBuffer.writeI8(FrameType.CANCEL << 2)
    frameBuffer.writeI8(0);
    return frameBuffer.toUint8Array();
}

export function encodePayloadFrame(
    streamId: number,
    complete: boolean,
    payload?: Payload
): Uint8Array {
    let frameBuffer = ByteBuffer.alloc(9);
    frameBuffer.writeI24(0) // frame length
    frameBuffer.writeI32(streamId); //stream id
    let flags = 0;
    if (complete) {
        console.log("complete")
        flags = flags | 0x40; //complete
    } else {
        console.log("next")
        flags = flags | 0x20; //next
    }
    if (payload) {
        writeTFrameTypeAndFlags(frameBuffer, FrameType.PAYLOAD, payload.metadata, flags)
        writePayload(frameBuffer, payload);
    } else {
        writeTFrameTypeAndFlags(frameBuffer, FrameType.PAYLOAD, undefined, flags)
    }
    refillFrameLength(frameBuffer);
    return frameBuffer.toUint8Array();
}

export function encodeErrorFrame(
    streamId: number,
    code: number,
    message: string
): Uint8Array {
    let frameBuffer = ByteBuffer.alloc(9);
    frameBuffer.writeI24(0) // frame length
    frameBuffer.writeI32(streamId); //stream id
    frameBuffer.writeI8(FrameType.ERROR << 2)
    frameBuffer.writeI8(0);
    frameBuffer.writeI32(code);
    frameBuffer.writeUint8Array(encode(message));
    refillFrameLength(frameBuffer);
    return frameBuffer.toUint8Array();
}

export function encodeMetadataPushFrame(
    payload: Payload
): Uint8Array {
    if (payload.metadata) {
        let frameBuffer = ByteBuffer.alloc(9);
        frameBuffer.writeI24(0) // frame length
        frameBuffer.writeI32(0); //stream id
        frameBuffer.writeI8((FrameType.METADATA_PUSH << 2) | 0x01)
        frameBuffer.writeI8(0);
        frameBuffer.writeUint8Array(payload.metadata);
        refillFrameLength(frameBuffer);
        return frameBuffer.toUint8Array();
    }
    return EMPTY_U8_ARRAY;
}

//todo add RESUME and RESUME_OK and EXT encode


function writeTFrameTypeAndFlags(frameBuffer: ByteBuffer, frameType: number, metadata: Uint8Array | undefined, flags: number) {
    if (metadata) {
        frameBuffer.writeI8(frameType << 2 | 1)
    } else {
        frameBuffer.writeI8(frameType << 2)
    }
    frameBuffer.writeI8(flags);
}

function writePayload(frameBuffer: ByteBuffer, payload?: Payload) {
    if (payload?.metadata) {
        frameBuffer.writeI24(payload.metadata.length)
        frameBuffer.writeUint8Array(payload.metadata)
    }
    if (payload?.data) {
        frameBuffer.writeUint8Array(payload.data)
    }
}

function refillFrameLength(frameBuffer: ByteBuffer) {
    let frameLength = frameBuffer.array().length - 3;
    frameBuffer.resetWriterIndex();
    frameBuffer.writeI24(frameLength)
}
