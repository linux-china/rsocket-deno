import {CompositeMetadata} from "../../rsocket/metadata/CompositeMetadata.ts";
import {ByteBuffer} from "../../rsocket/io/ByteBuffer.ts";
import {encode} from "../../deps.ts";

Deno.test("Write Test", () => {
    let byteBuffer = ByteBuffer.alloc(2);
    //wellknown avro
    byteBuffer.writeI8(0x80) //avro
    byteBuffer.writeI24(4) //metata length
    byteBuffer.writeI32(111)
    //wellknown cbor
    byteBuffer.writeI8(0x81) //cbor
    byteBuffer.writeI24(4) //metata length
    byteBuffer.writeI32(111)
    //user defined mime type
    let u8Array = encode("text/demo")
    byteBuffer.writeI8(u8Array.length)
    byteBuffer.writeUint8Array(u8Array);
    byteBuffer.writeI24(4)
    byteBuffer.writeI32(1111)
    byteBuffer.rewind();
    let compositeMetadata = new CompositeMetadata(byteBuffer)

    for (const metadata of compositeMetadata) {
        console.log(metadata)
    }
});
