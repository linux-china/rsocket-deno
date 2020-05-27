import Closer = Deno.Closer;
import {RSocketResponder} from "./core/RSocketResponder.ts";
import {SocketAcceptor} from "./SocketAcceptor.ts";

export class RSocketServer {
    private readonly _acceptor: SocketAcceptor

    constructor(acceptor: SocketAcceptor) {
        this._acceptor = acceptor;
    }

    public static create(acceptor: SocketAcceptor): RSocketServer {
        return new RSocketServer(acceptor);
    }

    public bind(url: string): Closer {
        let schema = url.substring(0, url.indexOf(":"))
        let urlObj = new URL(url.replace(schema + "://", "http://"))
        //todo WebSocket support
        const listener = Deno.listen({port: parseInt(urlObj.port)});
        let rSocketResponder = new RSocketResponder(urlObj, listener, this._acceptor);
        rSocketResponder.accept().then();
        return rSocketResponder;
    }

}
