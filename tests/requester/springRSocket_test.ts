import {RSocketConnector, Payload, CompositeMetadata, RoutingMetadata} from "../../mod.ts"
import {encode} from "../../deps.ts";
import {publisherToAsyncIterator} from "../../reactivestreams/mod.ts";


// Spring Boot application.properties
//    spring.rsocket.server.port=42252
//    spring.rsocket.server.transport=tcp
const rsocket = await RSocketConnector.create().connect("tcp://127.0.0.1:42252");

Deno.test("Spring RSocket RequestResponse", async () => {
    let compositeMetadata = CompositeMetadata.fromEntries(new RoutingMetadata("UserService.findById"))
    let payload = new Payload(encode("1"), compositeMetadata.toUint8Array());
    const result: Payload = await rsocket.requestResponse(payload);
    console.log(result.getDataUtf8())
});

Deno.test("Spring RSocket RequestStream", async () => {
    let compositeMetadata = CompositeMetadata.fromEntries(new RoutingMetadata("UserService.findAllUsers"))
    let payload = new Payload(encode("1"), compositeMetadata.toUint8Array());
    const publisher = await rsocket.requestStream(payload);
    for await (const data of publisherToAsyncIterator(publisher)) {
        console.log(data.getDataUtf8());
    }
});
