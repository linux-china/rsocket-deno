export class ByteBuffer {
    private _data: Array<number> = [];
    private _readerIndex: number = 0;
    private _writerIndex: number = 0;
    private _capacity: number = 0;

    public static fromArray(array: Array<number>): ByteBuffer {
        let byteBuffer = new ByteBuffer();
        byteBuffer._data = array;
        byteBuffer._capacity = array.length;
        return byteBuffer;
    }

    public static fromUint8Array(uint8Array: Uint8Array): ByteBuffer {
        let byteBuffer = new ByteBuffer();
        byteBuffer._data = Array.from(uint8Array);
        byteBuffer._capacity = uint8Array.length;
        return byteBuffer;
    }

    public static alloc(size: number): ByteBuffer {
        let byteBuffer = new ByteBuffer();
        byteBuffer._data = new Array(size);
        byteBuffer._capacity = size;
        return byteBuffer;
    }

    public readI8(): number | undefined {
        if (this._readerIndex < this._capacity) {
            let value = this._data[this._readerIndex];
            this._readerIndex += 1;
            return value;
        }
        return undefined;
    }

    public readI16(): number | undefined {
        return ByteBuffer.byteArrayToNumber(this.readBytes(2));
    }

    public readI24(): number | undefined {
        return ByteBuffer.byteArrayToNumber(this.readBytes(3));
    }

    public readI32(): number | undefined {
        return ByteBuffer.byteArrayToNumber(this.readBytes(4));
    }

    public readI64(): number | undefined {
        return ByteBuffer.byteArrayToNumber(this.readBytes(8));
    }

    public readBytes(len: number): Array<number> | undefined {
        if (this._readerIndex + len <= this._capacity) {
            let array = this._data.slice(this._readerIndex, this._readerIndex + len);
            this._readerIndex = this._readerIndex + len;
            return array;
        }
        return undefined;
    }

    public readUint8Array(len: number): Uint8Array | undefined {
        if (this._readerIndex + len <= this._capacity) {
            let array = this._data.slice(this._readerIndex, this._readerIndex + len);
            this._readerIndex = this._readerIndex + len;
            return Uint8Array.from(array);
        }
        return undefined;
    }

    public readRemain(): Array<number> | undefined {
        if (this._readerIndex < this._capacity) {
            let array = this._data.slice(this._readerIndex, this._capacity);
            this._readerIndex = this._capacity;
            return array;
        }
        return undefined;
    }

    private autoGrow() {
        if (this._capacity < this._data.length) {
            this._capacity = this._data.length;
        }
    }

    public writeI8(value: number) {
        this._data[this._writerIndex] = value
        this._writerIndex += 1;
        this.autoGrow();
    }

    public writeI16(value: number) {
        this.writeBytes(ByteBuffer.i16ToByteArray(value));
    }

    public writeI24(value: number) {
        this.writeBytes(ByteBuffer.i24ToByteArray(value));
    }

    public writeI32(value: number) {
        this.writeBytes(ByteBuffer.i32ToByteArray(value));
    }

    public writeI64(value: number) {
        this.writeBytes(ByteBuffer.i64ToByteArray(value));
    }

    public writeBytes(bytes: Array<number>) {
        if (bytes) {
            for (let i = 0; i < bytes.length; i++) {
                this._data[this._writerIndex] = bytes[i];
                this._writerIndex += 1;
            }
            this.autoGrow();
        }
    }

    public writeUint8Array(array: Uint8Array) {
        if (array) {
            for (let i = 0; i < array.length; i++) {
                this._data[this._writerIndex] = array[i];
                this._writerIndex += 1;
            }
            this.autoGrow();
        }
    }

    public isReadable(): boolean {
        return this._readerIndex < this._capacity;
    }

    public maxReadableBytes(): number {
        return this._capacity - this._readerIndex;
    }

    public isWritable(): boolean {
        return this._writerIndex < this._capacity;
    }

    public maxWritableBytes(): number {
        return this._capacity - this._readerIndex;
    }

    public rewind() {
        this._readerIndex = 0;
        this._writerIndex = 0;
    }

    public resetWriterIndex() {
        this._writerIndex = 0;
    }

    public resetReaderIndex() {
        this._writerIndex = 0;
    }

    public capacity(): number {
        return this._capacity;
    }

    public array(): Array<number> {
        return this._data;
    }

    public toUint8Array(): Uint8Array {
        return Uint8Array.from(this._data);
    }

    public static i64ToByteArray(value: number) {
        let byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
        for (let index = byteArray.length - 1; index < byteArray.length; index++) {
            let byte = value & 0xff;
            byteArray [index] = byte;
            value = (value - byte) / 256;
        }
        return byteArray.reverse();
    };

    public static i32ToByteArray(value: number) {
        let byteArray = [0, 0, 0, 0];
        for (let index = 0; index < byteArray.length; index++) {
            let byte = value & 0xff;
            byteArray [index] = byte;
            value = (value - byte) / 256;
        }
        return byteArray.reverse();
    };

    public static i24ToByteArray(value: number) {
        let byteArray = [0, 0, 0];
        for (let index = 0; index < byteArray.length; index++) {
            let byte = value & 0xff;
            byteArray [index] = byte;
            value = (value - byte) / 256;
        }
        return byteArray.reverse();
    };

    public static i16ToByteArray(value: number) {
        let byteArray = [0, 0];
        for (let index = 0; index < byteArray.length; index++) {
            let byte = value & 0xff;
            byteArray [index] = byte;
            value = (value - byte) / 256;
        }
        return byteArray.reverse();
    };

    public static byteArrayToNumber(byteArray: Array<number> | undefined): number | undefined {
        if (byteArray) {
            let value = 0;
            for (let i = 0; i < byteArray.length; i++) {
                value = (value * 256) + byteArray[i];
            }
            return value;
        }
        return undefined;
    };
}
