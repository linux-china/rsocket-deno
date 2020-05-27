export class RSocketError implements Error {
    message: string;
    name: string;
    code: number;

    constructor(code: number, message: string) {
        this.message = message;
        this.name = `RSocketError-${code}`;
        this.code = code;
    }
}

export const RESERVED = 0x00000000;
export const INVALID_SETUP = 0x00000001;
export const UNSUPPORTED_SETUP = 0x00000002;
export const REJECTED_SETUP = 0x00000003;
export const REJECTED_RESUME = 0x00000004;
export const CONNECTION_ERROR = 0x00000101;
export const CONNECTION_CLOSE = 0x00000102;
export const APPLICATION_ERROR = 0x00000201;
export const REJECTED = 0x00000202;
export const CANCELED = 0x00000203;
export const INVALID = 0x00000204;
