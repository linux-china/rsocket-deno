import {encodeSetupFrame, encodeRequestResponseFrame} from "../../rsocket/frame/frame.ts";
import {Payload} from "../../rsocket/Payload.ts";

Deno.test("Setup Payload Frame", () => {
    let payload = Payload.fromText("data", "metadata");
    let data = encodeSetupFrame(1, 2, "composite", "text/plain", payload);
    console.log(data);
});

Deno.test("Request Response Frame", () => {
    let payload = Payload.fromText("data", "metadata");
    let data = encodeRequestResponseFrame(1, payload);
    console.log(data);
});

