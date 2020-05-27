import {RSocketConnector, Payload} from "./mod.ts"

const rsocket = await RSocketConnector.create().connect("tcp://127.0.0.1:42252");

const result: Payload = await rsocket.requestResponse(Payload.fromText("Hello, I'm requester!", "metadata"));
console.log(result.getDataUtf8());
