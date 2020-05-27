import {Payload} from "./Payload.ts";
import {ErrorPublisher, Publisher, Subscriber} from "../reactivestreams/mod.ts";
import {CompositeMetadata, MetadataEntry, RoutingMetadata} from "./metadata/CompositeMetadata.ts";
import {MESSAGE_RSOCKET_COMPOSITE_METADATA} from "./metadata/WellKnownMimeType.ts";
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
        return Promise.reject(new Error("Not implemented"));
    }

    public requestChannel(payloads: Publisher<Payload>): Publisher<Payload> {
        return new ErrorPublisher<Payload>("Not implemented")
    }

    public requestResponse(payload: Payload): Promise<Payload> {
        return Promise.reject("Not implemented");
    }

    public requestStream(payload: Payload): Publisher<Payload> {
        return new ErrorPublisher<Payload>("Not implemented")
    }
}

type ServiceRouting = {
    service: string,
    method: string
}


export class RSocketRouteHandler extends AbstractRSocket {
    serviceCollection: Map<string, any>;

    constructor(serviceCollection: Map<string, any>) {
        super();
        this.serviceCollection = serviceCollection;
    }

    requestResponse(payload: Payload): Promise<Payload> {
        let jsonText = payload.getDataUtf8();
        if (jsonText && payload.metadata) {
            let compositeMetadata = CompositeMetadata.fromU8Array(payload.metadata);
            let entry = compositeMetadata.findEntry(MESSAGE_RSOCKET_COMPOSITE_METADATA.string);
            if (entry) {
                let routingMetadata = RoutingMetadata.fromEntry(entry);
                let routing = this.parseRouting(routingMetadata);
                let params = JSON.parse(jsonText);
                let handler = this.getServiceHandler(routing.service, routing.method);
                if (handler) {
                    let promiseResult;
                    if (Array.isArray(params)) {
                        promiseResult = handler(...params);
                    } else {
                        promiseResult = handler(params);
                    }
                    return promiseResult.then((result: any) => {
                        return Payload.fromText(JSON.stringify(result), "metadata")
                    })
                } else {
                    return Promise.reject(new RSocketError(INVALID, `service not found: ${routing.service}:${routing.method}`));
                }
            }
        }
        return Promise.reject(new RSocketError(INVALID, "Illegal request"));
    }

    public getServiceHandler(serviceName: string, method: string): any | undefined {
        let serviceInstance = this.serviceCollection.get(serviceName);
        if (serviceInstance) {
            return serviceInstance[method];
        }
        return undefined;
    }

    public parseRouting(routingMetadata: RoutingMetadata): ServiceRouting {
        let routingKey = routingMetadata.routingKey;
        let serviceName = routingKey.substring(0, routingKey.lastIndexOf("."))
        let methodName = routingKey.substring(routingKey.lastIndexOf(".") + 1)
        return {service: serviceName, method: methodName};
    }
}
