import {
    RSocketServer,
    forRequestResponse,
    Payload
} from "https://deno.land/x/rsocket/mod.ts"

const listenUrl = "ws://0.0.0.0:42252";
await RSocketServer.create(forRequestResponse(
    async (payload: Payload): Promise<Payload> => {
        console.log(`Received: ${payload.getDataUtf8()} `)
        return Payload.fromText("Hello, this is Deno Server!", "");
    })
).bind(listenUrl);

console.log(`RSocket Server started on ${listenUrl}`)
