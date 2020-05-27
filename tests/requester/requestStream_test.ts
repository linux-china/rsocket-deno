import {RSocketConnector, Payload} from "../../mod.ts"
import {publisherToAsyncIterator} from "../../reactivestreams/mod.ts";

const rsocket = await RSocketConnector.create().connect("ws://127.0.0.1:42252");

Deno.test("RSocket RequestStream", async () => {
    const publisher = rsocket.requestStream(Payload.fromText("Word Up", "metadata"));
    // async iterator style: await for ... of
    for await (const data of publisherToAsyncIterator(publisher)) {
        console.log(data.getDataUtf8());
    }
});
