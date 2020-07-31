import {parseFrames} from "../frame/frame.ts";
import {SocketAcceptor} from "../SocketAcceptor.ts";
import {FrameType, SetupFrame} from "../frame/frame.ts";
import {ConnectionSetupPayload} from "../Payload.ts";
import {RSocketRequester} from "./RSocketRequester.ts";
import {DenoTcpDuplexConnection, DenoWebSocketDuplexConnection} from "../DuplexConnection.ts";
import {
    Server,
    acceptWebSocket,
    isWebSocketCloseEvent,
    isWebSocketPingEvent,
    WebSocket,
} from "../../deps.ts";
import {ByteBuffer} from "../io/ByteBuffer.ts";

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
                        for await (const chunk of duplexConn) {
                            if (!chunk) {
                                rsocketRequester?.close();
                                break;
                            } else {
                                // noinspection DuplicatedCode
                                for (const frame of parseFrames(chunk)) {
                                    let header = frame.header;
                                    if (header.type == FrameType.SETUP) {
                                        let setupFrame = frame as SetupFrame;
                                        let connectSetupPayload = new ConnectionSetupPayload(setupFrame.keepAliveInterval, setupFrame.keepAliveMaxLifetime,
                                            setupFrame.header.flags, setupFrame.metadataMimeType, setupFrame.dataMimeType);
                                        let temp = new RSocketRequester(duplexConn, connectSetupPayload, "responder");
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

export class RSocketWebSocketResponder implements Deno.Closer {
    private readonly _acceptor: SocketAcceptor;
    private readonly _listener: Server;
    private readonly _url: URL;

    constructor(url: URL, listener: Server, acceptor: SocketAcceptor) {
        this._url = url;
        this._acceptor = acceptor;
        this._listener = listener;
    }

    public async handleWs(sock: WebSocket) {
        const duplexConn = new DenoWebSocketDuplexConnection(sock);
        let closed = false;
        let rsocketRequester: RSocketRequester | undefined;
        try {
            for await (const ev of sock) {
                if (typeof ev === "string") {
                    // text message
                    console.log("ws:Text", ev);
                    await sock.send(ev);
                } else if (ev instanceof Uint8Array) {
                    let chunk = ev as Uint8Array;
                    //append Frame Length: 3 bytes
                    let fullFrame = new Uint8Array(chunk.length + 3);
                    let frameLengthArray = ByteBuffer.i24ToByteArray(chunk.length);
                    fullFrame.set(frameLengthArray, 0);
                    fullFrame.set(chunk, 3);
                    // noinspection DuplicatedCode
                    for (const frame of parseFrames(fullFrame)) {
                        let header = frame.header;
                        if (header.type == FrameType.SETUP) {
                            let setupFrame = frame as SetupFrame
                            let connectSetupPayload = new ConnectionSetupPayload(setupFrame.keepAliveInterval, setupFrame.keepAliveMaxLifetime,
                                setupFrame.header.flags, setupFrame.metadataMimeType, setupFrame.dataMimeType);
                            let temp = new RSocketRequester(duplexConn, connectSetupPayload, "responder");
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
                } else if (isWebSocketPingEvent(ev)) {
                    const [, body] = ev;
                    // ping
                    console.log("ws:Ping", body);
                } else if (isWebSocketCloseEvent(ev)) {
                    // close
                    const {code, reason} = ev;
                    console.log("ws:Close", code, reason);
                }
            }
        } catch (err) {
            console.error(`failed to receive frame: ${err}`);
            if (!sock.isClosed) {
                await sock.close(1000).catch(console.error);
            }
        }
    }

    public async accept() {
        for await (const req of this._listener) {
            const {conn, r: bufReader, w: bufWriter, headers} = req;
            acceptWebSocket({conn, bufReader, bufWriter, headers})
                .then((sock: WebSocket) => this.handleWs(sock))
                .catch(async (err) => {
                    console.error(`failed to accept websocket: ${err}`);
                    await req.respond({status: 400});
                });
        }
    }

    close(): void {
        this._listener.close()
    }

}

