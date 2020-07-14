import {RSocket, AbstractRSocket} from "./RSocket.ts";
import {ConnectionSetupPayload, Payload} from "./Payload.ts";
import {Publisher} from "../reactivestreams/mod.ts";

export interface SocketAcceptor {
    accept(setup: ConnectionSetupPayload, sendingSocket: RSocket): RSocket | null
}

export function forRequestResponse(handler: (payload: Payload) => Promise<Payload>): SocketAcceptor {
    return {
        accept(setup: ConnectionSetupPayload, sendingSocket: RSocket): AbstractRSocket {
            return new class extends AbstractRSocket {
                requestResponse(payload: Payload): Promise<Payload> {
                    return handler(payload);
                }
            }();
        }
    }
}


export function forFireAndForget(handler: (payload: Payload) => Promise<void>): SocketAcceptor {
    return {
        accept(setup: ConnectionSetupPayload, sendingSocket: RSocket): AbstractRSocket {
            return new class extends AbstractRSocket {
                fireAndForget(payload: Payload): Promise<void> {
                    return handler(payload);
                }
            }();
        }
    }
}

export function forRequestStream(handler: (payload: Payload) => Publisher<Payload>): SocketAcceptor {
    return {
        accept(setup: ConnectionSetupPayload, sendingSocket: RSocket): AbstractRSocket {
            return new class extends AbstractRSocket {
                requestStream(payload: Payload): Publisher<Payload> {
                    return handler(payload);
                }
            }();
        }
    }
}

export function forRequestChannel(handler: (payloads: Publisher<Payload>) => Publisher<Payload>): SocketAcceptor {
    return {
        accept(setup: ConnectionSetupPayload, sendingSocket: RSocket): AbstractRSocket {
            return new class extends AbstractRSocket {
                requestChannel(payloads: Publisher<Payload>): Publisher<Payload> {
                    return handler(payloads);
                }
            }();
        }
    }
}
