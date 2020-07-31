import {ConnectionSetupPayload, Payload} from "./Payload.ts";
import {RSocketRequester} from "./core/RSocketRequester.ts";
import {AbstractRSocket, RSocket} from "./RSocket.ts";
import {RSocketError} from "./core/RSocketError.ts";
import {SocketAcceptor} from "./SocketAcceptor.ts";
import {parseFrames} from "./frame/frame.ts";
import {connectRSocket} from "./DuplexConnection.ts";

export class RSocketConnector {
    private _payload: Payload | undefined;
    private _keepAliveInterval = 20;
    private _keepAliveMaxLifeTime = 90;
    private _dataMimeType = "application/json";
    private _metadataMimeType = "message/x.rsocket.composite-metadata.v0";
    private _acceptor: SocketAcceptor | undefined;
    private _errorConsumer: ((error: RSocketError) => void) | undefined;

    public static create(): RSocketConnector {
        return new RSocketConnector();
    }

    public setupPayload(payload: Payload): RSocketConnector {
        this._payload = payload;
        return this;
    }

    public dataMimeType(dataMimeType: string): RSocketConnector {
        this._dataMimeType = dataMimeType;
        return this;
    }

    public metadataMimeType(metadataMimeType: string): RSocketConnector {
        this._metadataMimeType = metadataMimeType;
        return this;
    }

    public keepAlive(interval: number, maxLifeTime: number): RSocketConnector {
        this._keepAliveInterval = interval;
        this._keepAliveMaxLifeTime = maxLifeTime;
        return this;
    }

    public errorConsumer(errorConsumer: (error: RSocketError) => void): RSocketConnector {
        this._errorConsumer = errorConsumer;
        return this;
    }

    public acceptor(acceptor: SocketAcceptor): RSocketConnector {
        this._acceptor = acceptor;
        return this;
    }

    public async connect(url: string): Promise<RSocket> {
        let duplexConn = await connectRSocket(url);
        if (duplexConn === undefined) {
            return Promise.reject(`Failed to create connection with: ${url}`);
        }
        let connectionSetupPayload = new ConnectionSetupPayload(this._keepAliveInterval, this._keepAliveMaxLifeTime, 0, this._metadataMimeType, this._dataMimeType)
        if (this._payload) {
            connectionSetupPayload.data = this._payload.data;
            connectionSetupPayload.metadata = this._payload.metadata;
        }
        let rsocketRequester = new RSocketRequester(duplexConn, connectionSetupPayload, "requester");
        if (this._errorConsumer) {
            rsocketRequester.errorConsumer = this._errorConsumer;
        }
        if (this._acceptor) {
            let responder = this._acceptor.accept(connectionSetupPayload, rsocketRequester);
            if (responder == null) {
                return Promise.reject('RSOCKET-0x00000003: Connection refused, please check setup and security!');
            }
            rsocketRequester.responder = responder;
        }
        (async () => {
            let closed = false;
            while (!closed) {
                try {
                    for await (const chunk of duplexConn) {
                        if (!chunk) {
                            rsocketRequester?.close();
                            break;
                        } else {
                            for (const frame of parseFrames(chunk)) {
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
        })().then();
        await rsocketRequester.sendSetupPayload();
        return rsocketRequester;
    }

}
