import {RSocketConnector, Payload} from "../../mod.ts"

const rsocket = await RSocketConnector.create().connect("tcp://127.0.0.1:42252");

Deno.test("RSocket RequestResponse", async () => {
    const result: Payload = await rsocket.requestResponse(Payload.fromText("hello", "metadata"));
    console.log(result.getDataUtf8())
    rsocket.close();
});
