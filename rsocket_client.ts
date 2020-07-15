import {
    RSocketConnector,
    Payload
} from "https://deno.land/x/rsocket/mod.ts"

const rsocket = await RSocketConnector.create().connect("tcp://127.0.0.1:42252");

const result = await rsocket.requestResponse(Payload.fromText("Ping", ""));
console.log(result.getDataUtf8());
