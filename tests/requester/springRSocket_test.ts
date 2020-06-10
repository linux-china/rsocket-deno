import {RSocketConnector, Payload, CompositeMetadata, RoutingMetadata} from "../../mod.ts"
import {encode} from "../../deps.ts";
import {Publisher, publisherToAsyncIterator} from "../../reactivestreams/mod.ts";
import {buildServiceStub} from "../../mod.ts";

const {test} = Deno;

type User = {
    id: number,
    nick: string
}

interface UserService {
    findById(id: number): Promise<User>;

    findAllUsers(id: number): Publisher<User>
}

// Spring Boot application.properties
//    spring.rsocket.server.mapping-path=/rsocket
//    spring.rsocket.server.transport=websocket
const rsocket = await RSocketConnector.create().connect("ws://127.0.0.1:8080/rsocket");

const userService = buildServiceStub<UserService>(rsocket, "UserService")

test("UserService.findById", async () => {
    let user = await userService.findById(1);
    console.log(user);
});

test("UserService.findAllUsers", async () => {
    let users = userService.findAllUsers(1);
    for await (const user of publisherToAsyncIterator(users)) {
        console.log(user);
    }
});

test("Spring RSocket RequestResponse", async () => {
    let compositeMetadata = CompositeMetadata.fromEntries(new RoutingMetadata("UserService.findById"))
    let payload = new Payload(encode("1"), compositeMetadata.toUint8Array());
    const result: Payload = await rsocket.requestResponse(payload);
    console.log(result.getDataUtf8())
});

test("Spring RSocket RequestStream", async () => {
    let compositeMetadata = CompositeMetadata.fromEntries(new RoutingMetadata("UserService.findAllUsers"))
    let payload = new Payload(encode("1"), compositeMetadata.toUint8Array());
    const publisher = await rsocket.requestStream(payload);
    for await (const data of publisherToAsyncIterator(publisher)) {
        console.log(data.getDataUtf8());
    }
});
