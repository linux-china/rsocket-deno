import {Payload} from "./Payload.ts";
import {ErrorPublisher, Publisher} from "../reactivestreams/mod.ts";
import {RSocketError, INVALID} from "./core/RSocketError.ts";

export interface RSocket {
    /**
     * Fire and Forget interaction model of `ReactiveSocket`. The returned
     * Publisher resolves when the passed `payload` is successfully handled.
     */
    fireAndForget(payload: Payload): Promise<void>;

    /**
     * Request-Response interaction model of `ReactiveSocket`. The returned
     * Publisher resolves with the response.
     */
    requestResponse(payload: Payload): Promise<Payload>;

    /**
     * Request-Stream interaction model of `ReactiveSocket`. The returned
     * Publisher returns values representing the response(s).
     */
    requestStream(payload: Payload): Publisher<Payload>;

    /**
     * Request-Channel interaction model of `ReactiveSocket`. The returned
     * Publisher returns values representing the response(s).
     */
    requestChannel(payloads: Publisher<Payload>): Publisher<Payload>;

    /**
     * Metadata-Push interaction model of `ReactiveSocket`. The returned Publisher
     * resolves when the passed `payload` is successfully handled.
     */
    metadataPush(payload: Payload): Promise<void>;

    /**
     * Close this `ReactiveSocket` and the underlying transport connection.
     */
    close(): void;

    /**
     * Returns positive number representing the availability of RSocket requester. Higher is better, 0.0
     * means not available.
     */
    availability(): number;
}

export class AbstractRSocket implements RSocket {
    public availability(): number {
        return 1.0;
    }

    public close(): void {
    }

    public fireAndForget(payload: Payload): Promise<void> {
        return Promise.resolve(undefined);
    }

    public metadataPush(payload: Payload): Promise<void> {
        return Promise.reject(new RSocketError(INVALID, "Not implemented"));
    }

    public requestChannel(payloads: Publisher<Payload>): Publisher<Payload> {
        return new ErrorPublisher<Payload>(INVALID, "Not implemented")
    }

    public requestResponse(payload: Payload): Promise<Payload> {
        return Promise.reject(new RSocketError(INVALID, "Not implemented"));
    }

    public requestStream(payload: Payload): Publisher<Payload> {
        return new ErrorPublisher<Payload>(INVALID, "Not implemented")
    }
}
