import {
    WebSocket,
    isWebSocketCloseEvent,
    isWebSocketPingEvent,
    isWebSocketPongEvent,
    connectWebSocket
} from "../deps.ts";
import {ByteBuffer} from "./io/ByteBuffer.ts";

export interface DuplexConnection {
    write(chunk: Uint8Array): Promise<any>;

    receive(): AsyncIterableIterator<Uint8Array>;

    close(): void;
}

export class DenoTcpDuplexConnection implements DuplexConnection {
    conn: Deno.Conn
    _closed = false;

    constructor(conn: Deno.Conn) {
        this.conn = conn;
    }

    receive(): AsyncIterableIterator<Uint8Array> {
        return Deno.iter(this.conn);
    }

    write(chunk: Uint8Array): Promise<number> {
        return this.conn.write(chunk);
    }

    close() {
        if (!this._closed) {
            this._closed = true;
            this.conn.close();
        }
    }

}

export class DenoWebSocketDuplexConnection implements DuplexConnection {
    ws: WebSocket;

    constructor(ws: WebSocket) {
        this.ws = ws;
    }

    close(): void {
        this.ws.close().catch(console.error)
    }

    async* receive(): AsyncIterableIterator<Uint8Array> {
        try {
            for await (const ev of this.ws) {
                if (isWebSocketPingEvent(ev)) {  // ping event
                    console.log("ws:Ping");
                } else if (isWebSocketPongEvent(ev)) {
                    console.log("ws:pong");
                } else if (isWebSocketCloseEvent(ev)) { //close event
                    // close
                    const {code, reason} = ev;
                    console.log("ws:Close", code, reason);
                } else if (typeof ev === "string") {
                    // text message
                    console.log("ws:Text", ev);
                } else { //binary event
                    let frame = ev as Uint8Array;
                    //append Frame Length: 3 bytes
                    let fullFrame = new Uint8Array(frame.length + 3);
                    let frameLengthArray = ByteBuffer.i24ToByteArray(frame.length);
                    fullFrame.set(frameLengthArray, 0);
                    fullFrame.set(frame, 3);
                    yield fullFrame;
                }
            }
        } catch (err) {
            console.error(`failed to receive frame: ${err}`);
            if (!this.ws.isClosed) {
                await this.ws.close(1000).catch(console.error);
            }
        }
    }

    write(chunk: Uint8Array): Promise<void> {
        //remove frame length: 3 bytes
        return this.ws.send(chunk.slice(3));
    }

}

export async function connectRSocket(url: string): Promise<DuplexConnection | undefined> {
    let schema = url.substring(0, url.indexOf(":"))
    let urlObj = new URL(url.replace(schema + "://", "http://"))
    let duplexConn: DuplexConnection | undefined;
    if (schema === 'tcp') {
        const tcpConn = await Deno.connect({hostname: urlObj.hostname, port: parseInt(urlObj.port)})
        duplexConn = new DenoTcpDuplexConnection(tcpConn);
    } else if (schema == "ws" || schema == "wss") {
        const websocket = await connectWebSocket(url);
        duplexConn = new DenoWebSocketDuplexConnection(websocket)
    }
    return duplexConn;
}



