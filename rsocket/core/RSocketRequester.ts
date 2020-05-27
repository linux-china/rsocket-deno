import {RSocket} from "../RSocket.ts";
import {Payload} from "../Payload.ts";
import {DefaultQueueProcessor, Publisher, Subscriber, Subscription} from "../../reactivestreams/mod.ts"
import {
    FrameType,
    encodeRequestResponseFrame,
    PayloadFrame,
    KeepAliveFrame,
    encodeKeepAlive,
    ErrorFrame,
    RequestResponseFrame,
    encodeErrorFrame,
    encodePayloadFrame,
    RequestNFrame,
    RequestFNFFrame,
    MetadataPushFrame,
    encodeRequestStreamFrame,
    encodeRequestFNFFrame,
    encodeRequestChannelFrame,
    encodeMetadataPushFrame, RequestStreamFrame
} from "../frame/frame.ts"
import {StreamIdSupplier} from "./StreamIdSupplier.ts";
import {APPLICATION_ERROR, RSocketError} from "./RSocketError.ts";
import {ConnectionSetupPayload} from "../Payload.ts";
import {encodeSetupFrame} from "../frame/frame.ts";
import {DuplexConnection} from "../DuplexConnection.ts";

const MAX_REQUEST_NUMBER = 0x7fffffff;

export class RSocketRequester implements RSocket {
    private _closed: boolean = false;
    private _keepAliveInterval: number | undefined;
    private _streamIdSupplier: StreamIdSupplier;
    private readonly _connectionSetupPayload: ConnectionSetupPayload;
    private readonly _connection: DuplexConnection;
    private senders: Map<number, Subscriber<Payload>> = new Map()
    private _responder: RSocket | undefined;
    private receivers: Map<number, any> = new Map();
    private _errorConsumer: ((error: RSocketError) => void) | undefined;
    private readonly _mode: string = "requester"; //ort responder

    public constructor(connection: DuplexConnection, connectionSetupPayload: ConnectionSetupPayload, streamIdSupplier: StreamIdSupplier, mode: string) {
        this._connection = connection;
        this._connectionSetupPayload = connectionSetupPayload;
        this._streamIdSupplier = streamIdSupplier;
        this._mode = mode;
    }

    set errorConsumer(value: ((error: RSocketError) => void) | undefined) {
        this._errorConsumer = value;
    }

    set responder(value: RSocket | undefined) {
        this._responder = value;
    }

    public async sendSetupPayload() {
        await this._connection.write(this.setupPayloadFrame());
        if (this._mode === 'requester') {
            this._keepAliveInterval = setInterval(() => {
                if (!this._closed) {
                    this._connection.write(encodeKeepAlive(false, 0)).then()
                } else {
                    clearInterval(this._keepAliveInterval);
                }
            }, this._connectionSetupPayload.keepAliveInterval * 1000);
        }
    }

    public async receiveFrame(frame: any) {
        let header = frame.header;
        switch (header.type) {
            case FrameType.PAYLOAD: {
                let payloadFrame = frame as PayloadFrame
                let streamId = header.streamId;
                let subscriber = this.senders.get(streamId);
                if (subscriber) {
                    let payload = payloadFrame.payload;
                    if (payloadFrame.completed) {
                        this.senders.delete(streamId);
                        if (payload && payload.data) {
                            subscriber.onNext(payload);
                        }
                        subscriber.onComplete();
                    } else {
                        if (payload && payload.data) {
                            subscriber.onNext(payload);
                        }
                    }
                }
                break;
            }
            case FrameType.KEEPALIVE: {
                let keepAliveFrame = frame as KeepAliveFrame
                if (keepAliveFrame.respond) {
                    await this._connection.write(encodeKeepAlive(false, keepAliveFrame.lastReceivedPosition))
                }
                break;
            }
            case FrameType.ERROR: {
                let errorFrame = frame as ErrorFrame
                let streamId = header.streamId;
                let error = new RSocketError(errorFrame.code, errorFrame.message)
                if (streamId == 0 && this._errorConsumer) {
                    this._errorConsumer(error);
                } else {
                    let subscriber = this.senders.get(streamId);
                    if (subscriber) {
                        this.senders.delete(streamId)
                        subscriber.onError(error);
                    }
                }
                break;
            }
            case FrameType.REQUEST_RESPONSE: {
                let requestResponseFrame = frame as RequestResponseFrame
                if (this._responder && requestResponseFrame.payload) {
                    try {
                        let response = await this._responder.requestResponse(requestResponseFrame.payload)
                        await this._connection.write(encodePayloadFrame(header.streamId, true, response))
                    } catch (e) {
                        let rsocketError = convertToRSocketError(e);
                        await this._connection.write(encodeErrorFrame(header.streamId, rsocketError.code, rsocketError.message));
                    }
                }
                break;
            }
            case FrameType.REQUEST_FNF: {
                let requestFNFFrame = frame as RequestFNFFrame
                if (this._responder && requestFNFFrame.payload) {
                    try {
                        await this._responder.fireAndForget(requestFNFFrame.payload)
                    } catch (e) {
                    }
                }
                break;
            }
            case FrameType.REQUEST_STREAM: {
                let streamFrame = frame as RequestStreamFrame
                if (this._responder && streamFrame.payload) {
                    let requesterStreamId = streamFrame.header.streamId;
                    try {
                        let publisher = this._responder.requestStream(streamFrame.payload);
                        publisher.subscribe({
                            onSubscribe: (subscription: Subscription) => {

                            },

                            onNext: (payload: Payload) => {
                                this._connection.write(encodePayloadFrame(requesterStreamId, false, payload)).then();
                            },

                            onError: (error: any) => {
                                let rsocketError = convertToRSocketError(error);
                                this._connection.write(encodeErrorFrame(requesterStreamId, rsocketError.code, rsocketError.message)).then();
                            },

                            onComplete: () => {
                                this._connection.write(encodePayloadFrame(requesterStreamId, true)).then()
                            }
                        })
                    } catch (e) {
                    }
                }
                break;
            }
            case FrameType.METADATA_PUSH: {
                let metadataPushFrame = frame as MetadataPushFrame
                if (this._responder && metadataPushFrame.payload) {
                    try {
                        await this._responder.metadataPush(metadataPushFrame.payload)
                    } catch (e) {
                    }
                }
                break;
            }
            case FrameType.REQUEST_N: {
                //todo implement request_N
                break;
            }
            case FrameType.CANCEL: {
                //todo implement cancel
                break;
            }
        }
    }

    public availability(): number {
        return this._closed ? 0.0 : 1.0;
    }

    async fireAndForget(payload: Payload) {
        let streamId = this._streamIdSupplier.nextStreamId(this.senders)
        await this._connection.write(encodeRequestFNFFrame(streamId, payload))
    }

    async metadataPush(payload: Payload) {
        await this._connection.write(encodeMetadataPushFrame(payload))
    }

    requestChannel(payloads: Publisher<Payload>): Publisher<Payload> {
        let processor = new RSocketStreamQueueProcessor(() => {
            const streamId = this._streamIdSupplier.nextStreamId(this.senders);
            this._connection.write(encodeRequestChannelFrame(streamId, false, MAX_REQUEST_NUMBER)).then(() => {
                this.senders.set(streamId, processor);
                processor.onSubscribe({
                    request: (n: number) => {
                        //todo back pressure
                    },

                    cancel: () => {
                        //todo cancel operation
                    }
                });
                payloads.subscribe({
                    onSubscribe: (subscription: Subscription) => {

                    },

                    onNext: (payload: Payload) => {
                        this._connection.write(encodePayloadFrame(streamId, false, payload)).then()
                    },

                    onError: (error: any) => {
                        let rsocketError = convertToRSocketError(error);
                        this._connection.write(encodeErrorFrame(streamId, rsocketError.code, rsocketError.message)).then()
                    },

                    onComplete: () => {
                        this._connection.write(encodePayloadFrame(streamId, true)).then()
                    }
                });
            });
        });
        return processor;
    }

    requestResponse(payload: Payload): Promise<Payload> {
        return new Promise<Payload>((resolve, reject) => {
            let streamId = this._streamIdSupplier.nextStreamId(this.senders)
            this._connection.write(encodeRequestResponseFrame(streamId, payload)).then(() => {
                this.senders.set(streamId, payloadSubscriberFromPromise(resolve, reject));
            });
        });
    }

    requestStream(payload: Payload): Publisher<Payload> {
        let processor = new RSocketStreamQueueProcessor(() => {
            const streamId = this._streamIdSupplier.nextStreamId(this.senders);
            this._connection.write(encodeRequestStreamFrame(streamId, MAX_REQUEST_NUMBER, payload)).then(() => {
                this.senders.set(streamId, processor);
                processor.onSubscribe({
                    request: (n: number) => {
                        //todo back pressure
                    },

                    cancel: () => {
                        //todo cancel operation
                    }
                });
            });
        });
        return processor;
    }


    public close(): void {
        this._closed = true;
        if (this._keepAliveInterval != undefined) {
            clearInterval(this._keepAliveInterval);
        }
        try {
            this._connection.close()
        } catch (e) {

        }
    }

    private setupPayloadFrame(): Uint8Array {
        return encodeSetupFrame(this._connectionSetupPayload.keepAliveInterval * 1000, this._connectionSetupPayload.keepAliveMaxLifetime * 1000,
            this._connectionSetupPayload.metadataMimeType, this._connectionSetupPayload.dataMimeType,
            this._connectionSetupPayload)
    }
}

function convertToRSocketError(e: any): RSocketError {
    if (e == null) {
        return new RSocketError(APPLICATION_ERROR, "Error")
    } else if (typeof e === 'object' && e.code && e.message) {
        return e as RSocketError;
    } else {
        return new RSocketError(APPLICATION_ERROR, e.toString());
    }
}


function payloadSubscriberFromPromise(resolve: any, reject: any): Subscriber<Payload> {
    return {
        onSubscribe: (subscription: Subscription) => {

        },

        onNext: (payload: Payload) => {
            resolve(payload);
        },

        onError: (error: any) => {
            reject(error);
        },

        onComplete: () => {
            resolve(null);
        }
    }

}

class RSocketStreamQueueProcessor extends DefaultQueueProcessor<Payload> {
    subscribeCallback: () => void;

    constructor(subscribeCallback: () => void) {
        super();
        this.subscribeCallback = subscribeCallback;
    }

    onSubscribe(subscription: Subscription) {
        super.onSubscribe(subscription);
    }

    subscribe(subscriber: Subscriber<Payload>): void {
        super.subscribe(subscriber)
        this.subscribeCallback()
    }

}
