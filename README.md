RSocket Deno module
===================

🦕Deno library to create/consume RSocket services.

# What is RSocket?

RSocket is a binary protocol for use on byte stream transports such as TCP, WebSockets, and Aeron.
It enables the following symmetric interaction models via async message passing over a single connection:

* request/response (stream of 1)
* request/stream (finite stream of many)
* fire-and-forget (no response)
* channel (bi-directional streams)

# How to use?

### Start RSocket Server with Deno

```
$ deno run --allow-net https://deno.land/x/rsocket/rsocket_server.ts
```

and RSocket server side code as following: 

```typescript
import {
    RSocketServer,
    forRequestResponse,
    Payload
} from "https://deno.land/x/rsocket/mod.ts"

await RSocketServer.create(forRequestResponse(
    async (payload: Payload): Promise<Payload> => {
        console.log(`Received: ${payload.getDataUtf8()} `)
        return Payload.fromText("Hello, this is Deno Server!", "");
    })
).bind("tcp://0.0.0.0:42252");

console.log("RSocket Server started on 0.0.0.0:42252")

```

### Start RSocket requester to test async RPC call

```
$ deno run --allow-net https://deno.land/x/rsocket/rsocket_client.ts
```

and RSocket client side code as following: 

```typescript
import {
    RSocketConnector,
    Payload
} from "https://deno.land/x/rsocket/mod.ts"

const rsocket = await RSocketConnector.create().connect("tcp://127.0.0.1:42252");

const result = await rsocket.requestResponse(Payload.fromText("Hello, I'm requester!", ""));
console.log(result.getDataUtf8());
```


# Service router and stub

#### Service route for RSocket server side

```typescript
import {
    RSocketServer,
    RSocket,
    ConnectionSetupPayload,
    RSocketRouteHandler
} from "https://deno.land/x/rsocket/mod.ts"

//RSocket Service
class UserService {

    async findNickById(id: number): Promise<string> {
        return "DenoServer";
    }
}

const server = await RSocketServer.create({
    accept(setup: ConnectionSetupPayload, sendingSocket: RSocket) {
        return RSocketRouteHandler.fromHandler("com.example.UserService", new UserService());
    }
}).bind("tcp://127.0.0.1:42252");
```

### Service stub for requester side

```typescript
import {RSocketConnector, buildServiceStub} from "https://deno.land/x/rsocket/mod.ts"

const rsocket = await RSocketConnector.create().connect("tcp://127.0.0.1:42252");

interface UserService {
    findNickById(id: number): Promise<string>;
}

const userService = buildServiceStub<UserService>(rsocket, "com.example.UserService")

let nick = await userService.findNickById(1);
console.log(nick)

```

# Interoperate with Spring Boot RSocket

Please refer [springRSocket_test.ts](https://deno.land/x/rsocket/tests/requester/springRSocket_test.ts)

# TODO

#### RSocket

- Operations
  - [x] METADATA_PUSH
  - [x] REQUEST_FNF
  - [x] REQUEST_RESPONSE
  - [x] REQUEST_STREAM
  - [x] REQUEST_CHANNEL
  - [ ] Back Pressure
- More Operations
  - [x] Error
  - [ ] Cancel
  - [x] Keepalive
- QoS
  - [ ] RequestN
  - [ ] Lease
- Transport
  - [x] TCP
  - [ ] Websocket: working
- High Level APIs
  - [x] Client
  - [x] Server

# References

* RSocket: https://rsocket.io/
* Deno: https://deno.land/
* RSocket-JS: https://github.com/rsocket/rsocket-js
* RxJS: https://github.com/ReactiveX/rxjs
* rxjs-for-await: https://github.com/benlesh/rxjs-for-await
* IxJS: Interactive Extensions for JavaScript https://github.com/ReactiveX/IxJS
