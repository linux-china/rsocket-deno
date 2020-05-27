import {Payload} from "../Payload.ts";
import {ErrorPublisher, Publisher} from "../../reactivestreams/mod.ts";
import {CompositeMetadata, RoutingMetadata} from "../metadata/CompositeMetadata.ts";
import {MESSAGE_RSOCKET_ROUTING} from "../metadata/WellKnownMimeType.ts";
import {RSocketError, INVALID} from "./RSocketError.ts";
import {encode} from "../../deps.ts";
import {RSocket} from "../RSocket.ts";

type ServiceRouting = {
    service: string,
    method: string
}

export class RSocketRouteHandler implements RSocket {
    serviceCollection: Map<string, any> = new Map();

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

    requestChannel(payloads: Publisher<Payload>): Publisher<Payload> {
        return new ErrorPublisher<Payload>(INVALID, "Not implemented")
    }

    metadataPush(payload: Payload): Promise<void> {
        return Promise.resolve(undefined);
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

    availability(): number {
        return 1.0;
    }

    close(): void {
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
