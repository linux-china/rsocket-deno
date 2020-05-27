import {Payload} from "./Payload.ts";
import {ErrorPublisher, Publisher} from "../reactivestreams/mod.ts";
import {CompositeMetadata, RoutingMetadata} from "./metadata/CompositeMetadata.ts";
import {MESSAGE_RSOCKET_ROUTING} from "./metadata/WellKnownMimeType.ts";
import {RSocketError, INVALID, APPLICATION_ERROR} from "./core/RSocketError.ts";
import {encode} from "../deps.ts";

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

type ServiceRouting = {
    service: string,
    method: string
}


export class RSocketRouteHandler extends AbstractRSocket {
    serviceCollection: Map<string, any> = new Map();

    constructor() {
        super();
    }

    public static fromHandler(serviceName: string, handler: any) {
        const routeHandler = new RSocketRouteHandler();
        routeHandler.addService(serviceName, handler);
        return routeHandler;
    }

    public addService(serviceName: string, handler: any): void {
        this.serviceCollection.set(serviceName, handler);
    }

    requestResponse(payload: Payload): Promise<Payload> {
        if (payload.metadata) {
            let compositeMetadata = CompositeMetadata.fromU8Array(payload.metadata);
            let routing = this.parseRouting(compositeMetadata);
            if (routing) {
                let params: any[] = [];
                let jsonText = payload.getDataUtf8();
                if (jsonText) {
                    let jsonObject = JSON.parse(jsonText);
                    if (Array.isArray(jsonText)) {
                        params = jsonObject;
                    } else {
                        params[0] = jsonObject;
                    }
                }
                let serviceHandler = this.getServiceHandler(routing.service, routing.method);
                if (serviceHandler) {
                    return serviceHandler(...params).then((result: any) => {
                        return Payload.fromText(JSON.stringify(result), "");
                    })
                }
            }
        }
        return Promise.reject(new RSocketError(INVALID, "Handler not found!"));
    }


    fireAndForget(payload: Payload): Promise<void> {
        if (payload.metadata) {
            let compositeMetadata = CompositeMetadata.fromU8Array(payload.metadata);
            let routing = this.parseRouting(compositeMetadata);
            if (routing) {
                let params: any[] = [];
                let jsonText = payload.getDataUtf8();
                if (jsonText) {
                    let jsonObject = JSON.parse(jsonText);
                    if (Array.isArray(jsonText)) {
                        params = jsonObject;
                    } else {
                        params[0] = jsonObject;
                    }
                }
                let serviceHandler = this.getServiceHandler(routing.service, routing.method);
                if (serviceHandler) {
                    return serviceHandler(...params).then((result: any) => {
                        return Payload.fromText(JSON.stringify(result), "")
                    })
                }
            }
        }
        return Promise.reject(new RSocketError(INVALID, "Handler not found!"));
    }


    requestStream(payload: Payload): Publisher<Payload> {
        if (payload.metadata) {
            let compositeMetadata = CompositeMetadata.fromU8Array(payload.metadata);
            let routing = this.parseRouting(compositeMetadata);
            if (routing) {
                let params: any[] = [];
                let jsonText = payload.getDataUtf8();
                if (jsonText) {
                    let jsonObject = JSON.parse(jsonText);
                    if (Array.isArray(jsonText)) {
                        params = jsonObject;
                    } else {
                        params[0] = jsonObject;
                    }
                }
                let serviceHandler = this.getServiceHandler(routing.service, routing.method);
                if (serviceHandler) {
                    return serviceHandler(...params).then((result: any) => {
                        return Payload.fromText(JSON.stringify(result), "")
                    })
                }
            }
        }
        return new ErrorPublisher(INVALID, "Handler not found!");
    }

    public getServiceHandler(serviceName: string, method: string): any | undefined {
        let serviceInstance = this.serviceCollection.get(serviceName);
        if (serviceInstance) {
            return serviceInstance[method];
        }
        return undefined;
    }

    public parseRouting(compositeMetadata: CompositeMetadata): ServiceRouting | undefined {
        let metadataEntry = compositeMetadata.findEntry(MESSAGE_RSOCKET_ROUTING.mimeType);
        if (metadataEntry) {
            let routingMetadata = RoutingMetadata.fromEntry(metadataEntry);
            let routingKey = routingMetadata.routingKey;
            let serviceName = routingKey.substring(0, routingKey.lastIndexOf("."));
            let methodName = routingKey.substring(routingKey.lastIndexOf(".") + 1);
            return {service: serviceName, method: methodName};
        }
        return undefined;
    }
}

export function buildServiceStub<T>(rsocket: RSocket, serviceName: string): T {
    let handler = {
        get(target: any, methodName: string) {
            return (...args: any[]) => {
                let payload = new Payload();
                if (args) {
                    payload.data = encode(JSON.stringify(args));
                }
                let compositeMetadata = CompositeMetadata.fromEntries(new RoutingMetadata(`${serviceName}.${methodName}`));
                payload.metadata = compositeMetadata.toUint8Array();
                return rsocket.requestResponse(payload)
                    .then(payload => {
                        let jsonText = payload.getDataUtf8();
                        if (jsonText) {
                            return JSON.parse(jsonText);
                        }
                        return undefined;
                    });
            }
        }
    };
    return new Proxy({}, handler);
}
