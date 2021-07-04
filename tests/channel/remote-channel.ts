/// <reference lib="dom" />
import {RSocketServer, Payload, RSocket, RSocketConnector} from "../../mod.ts";
import {forFireAndForget} from "../../rsocket/SocketAcceptor.ts";

export class RemoteBroadcastChannel {
    onmessage?: (message: string) => void;
    responder?: Deno.Closer;
    requester?: Promise<RSocket>;

    constructor(url: string) {
        if (url.indexOf("://0.0.0.0") >= 0) { // listen
            this.responder = RSocketServer.create(forFireAndForget(
                async (payload: Payload): Promise<void> => {
                    const data = payload.getDataUtf8() as string;
                    if (this.onmessage) {
                        this.onmessage(data);
                    }
                })
            ).bind(url);
        } else {
            this.requester = RSocketConnector.create().connect(url);
        }
    }

    post(message: string) {
        if (this.requester) {
            this.requester.then(rsocket => {
                rsocket.fireAndForget(Payload.fromText(message, "")).then()
            });
        } else if (this.onmessage) {
            this.onmessage(message);
        }
    }

    close() {
        if (this.requester) {
            this.requester.then(rsocket => {
                rsocket.close();
            });
            this.requester = undefined;
        }
        this.responder?.close();
    }

}
