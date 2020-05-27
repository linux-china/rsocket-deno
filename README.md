RSocket Deno module
===================

🦕Deno library to create/consume RSocket services.

### What is RSocket?

RSocket is a binary protocol for use on byte stream transports such as TCP, WebSockets, and Aeron.
It enables the following symmetric interaction models via async message passing over a single connection:

* request/response (stream of 1)
* request/stream (finite stream of many)
* fire-and-forget (no response)
* channel (bi-directional streams)

### Usage

* Start RSocket Server with Deno

```
$ deno run --allow-net rsocket_server.ts
```

Server side example:

```typescript
import {Payload, RSocketServer, forRequestResponse} from "./mod.ts"

await RSocketServer.create(forRequestResponse(async (payload: Payload): Promise<Payload> => {
    console.log(`Received: ${payload.getDataUtf8()} `)
    return Payload.fromText("Hello, this is Deno Server!", "metadata");
})).bind("tcp://0.0.0.0:42252");

console.log("RSocket Server started on 0.0.0.0:42252")

```

* Start RSocket Client to test async RPC call

```
$ deno run --allow-net rsocket_client.ts
```

Client side example:

```typescript
import {RSocketConnector} from "./rsocket/RSocketConnector.ts"
import {Payload} from "./rsocket/Payload.ts";

const rsocket = await RSocketConnector.create().connect("tcp://127.0.0.1:42252");

let response = await rsocket.requestResponse(Payload.fromText("hello", "metadata"));
console.log(response.getDataUtf8())
```

## Service Routing

Please refer rsocket_server_service_collection.ts under tests/server

## Interoperate with Spring Boot RSocket

Please refer springRSocket_test.ts under tests/requester

## TODO

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

#### Reactive Streams

* Convert between Publisher and AsyncIterable
* Convert between Publisher and RxJS 7.0?

## References

* RSocket: https://rsocket.io/
* Deno: https://deno.land/
* RSocket-JS: https://github.com/rsocket/rsocket-js
* RxJS: https://github.com/ReactiveX/rxjs
* rxjs-for-await: https://github.com/benlesh/rxjs-for-await
* IxJS: Interactive Extensions for JavaScript https://github.com/ReactiveX/IxJS
