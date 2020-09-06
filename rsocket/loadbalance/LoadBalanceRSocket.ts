import {Payload, RSocket, RSocketConnector} from "../../mod.ts";
import {Publisher} from "../../reactivestreams/mod.ts";

class LoadBalanceRSocket implements RSocket {
    private connections: Array<RSocket> = [];
    private url2Conn = new Map<string, RSocket>();
    private poolSize = 0;
    private counter = 0;

    async refreshUrl(urls: Array<string>) {
        let newConnections: Array<RSocket> = [];
        let newUrl2Conn = new Map<string, RSocket>();
        let staleConnections = new Map<string, RSocket>();
        for (const url of urls) {
            let rsocket = this.url2Conn.get(url);
            if (rsocket == undefined) {
                rsocket = await this.connect(url);
            }
            newConnections[newConnections.length] = rsocket;
            newUrl2Conn.set(url, rsocket);
        }
        for (let [url, rsocket] of this.url2Conn.entries()) {
            if (newUrl2Conn.get(url) == undefined) {
                staleConnections.set(url, rsocket);
            }
        }
        this.connections = newConnections;
        this.url2Conn = newUrl2Conn;
        this.poolSize = this.connections.length;
        this.closeStales(staleConnections);
    }

    availability(): number {
        return 1.0;
    }

    close(): void {
        for (const rsocket of this.connections) {
            rsocket.close();
        }
    }

    closeStales(connections: Map<string, RSocket>) {
        for (let [url, rsocket] of connections.entries()) {
            console.log("Close the RSocket: " + url);
            rsocket.close();
        }
    }

    fireAndForget(payload: Payload): Promise<void> {
        return this.getRandomRSocket().fireAndForget(payload);
    }

    metadataPush(payload: Payload): Promise<void> {
        return this.getRandomRSocket().metadataPush(payload);
    }

    requestChannel(payloads: Publisher<Payload>): Publisher<Payload> {
        return this.getRandomRSocket().requestChannel(payloads);
    }

    requestResponse(payload: Payload): Promise<Payload> {
        return this.getRandomRSocket().requestResponse(payload);
    }

    requestStream(payload: Payload): Publisher<Payload> {
        return this.getRandomRSocket().requestStream(payload);
    }

    getRandomRSocket(): RSocket {
        this.counter = this.counter + 1;
        if (this.counter >= 0x7FFFFFFF) {
            this.counter = 0;
        }
        return this.connections[this.counter % this.poolSize];
    }

    connect(url: string): Promise<RSocket> {
        return RSocketConnector.create().connect("tcp://127.0.0.1:42252");
    }

}
