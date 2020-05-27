import {parseFrames} from "../frame/frame.ts";
import {SocketAcceptor} from "../SocketAcceptor.ts";
import {FrameType, SetupFrame} from "../frame/frame.ts";
import {ConnectionSetupPayload} from "../Payload.ts";
import {RSocketRequester} from "./RSocketRequester.ts";
import {StreamIdSupplier} from "./StreamIdSupplier.ts";
import {DenoTcpDuplexConnection} from "../DuplexConnection.ts";

export class RSocketResponder implements Deno.Closer {
    private readonly _acceptor: SocketAcceptor;
    private readonly _listener: Deno.Listener;
    private readonly _url: URL;

    constructor(url: URL, listener: Deno.Listener, acceptor: SocketAcceptor) {
        this._url = url;
        this._acceptor = acceptor;
        this._listener = listener;
    }

    public async accept() {
        for await (const conn of this._listener) {
            const duplexConn = new DenoTcpDuplexConnection(conn);
            (async () => {
                let closed = false;
                let rsocketRequester: RSocketRequester | undefined;
                while (!closed) {
                    try {
                        for await (const chunk of duplexConn.receive()) {
                            for (const frame of parseFrames(chunk)) {
                                let header = frame.header;
                                if (header.type == FrameType.SETUP) {
                                    let setupFrame = frame as SetupFrame
                                    let connectSetupPayload = new ConnectionSetupPayload(setupFrame.keepAliveInterval, setupFrame.keepAliveMaxLifetime,
                                        setupFrame.header.flags, setupFrame.metadataMimeType, setupFrame.dataMimeType);
                                    let temp = new RSocketRequester(duplexConn, connectSetupPayload, StreamIdSupplier.serverSupplier(),"responder");
                                    let responder = this._acceptor.accept(connectSetupPayload, temp);
                                    if (!responder) {
                                        closed = true;
                                        duplexConn.close();
                                        break;
                                    } else {
                                        temp.responder = responder;
                                        rsocketRequester = temp;
                                    }
                                } else {
                                    rsocketRequester?.receiveFrame(frame).then();
                                }
                            }
                        }
                    } catch (e) {
                        closed = true;
                        duplexConn.close();
                        break;
                    }
                }
            })().then()
        }
    }

    close(): void {
        this._listener.close()
    }

}
