import {createWebSocket, handshake, WebSocket} from "https://deno.land/std@0.91.0/ws/mod.ts";
import {BufReader, BufWriter} from "https://deno.land/std@0.91.0/io/bufio.ts";

export type {WebSocket} from "https://deno.land/std@0.91.0/ws/mod.ts";
export {
    acceptWebSocket,
    isWebSocketCloseEvent,
    isWebSocketPingEvent,
    isWebSocketPongEvent
} from "https://deno.land/std@0.91.0/ws/mod.ts"

export {Server, serve} from "https://deno.land/std@0.91.0/http/server.ts";


/** A default TextEncoder instance */
const encoder = new TextEncoder();

/** Shorthand for new TextEncoder().encode() */
export function encode(input?: string): Uint8Array {
    return encoder.encode(input);
}

/** A default TextDecoder instance */
const decoder = new TextDecoder();

/** Shorthand for new TextDecoder().decode() */
export function decode(input?: Uint8Array): string {
    return decoder.decode(input);
}

/**
 * Connect to given websocket endpoint url. Endpoint must be acceptable for URL.
 */
export async function connectWebSocket(
    endpoint: string,
    headers: Headers = new Headers(),
): Promise<WebSocket> {
    const url = new URL(endpoint);
    const {hostname} = url;
    let conn: Deno.Conn;
    if (url.protocol === "http:" || url.protocol === "ws:") {
        const port = parseInt(url.port || "80");
        conn = await Deno.connect({hostname, port});
    } else if (url.protocol === "https:" || url.protocol === "wss:") {
        const port = parseInt(url.port || "443");
        conn = await Deno.connectTls({hostname, port});
    } else {
        throw new Error("ws: unsupported protocol: " + url.protocol);
    }
    const bufWriter = new BufWriter(conn);
    const bufReader = new BufReader(conn);
    try {
        await handshake(url, headers, bufReader, bufWriter);
    } catch (err) {
        conn.close();
        throw err;
    }
    return createWebSocket({
        conn,
        bufWriter,
        bufReader,
        mask: createMask(),
    });
}

// Create client-to-server mask, random 32bit number
function createMask(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(4));
}
