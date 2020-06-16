export interface Subscription {
    request(n: number): void;

    cancel(): void;
}

export interface Subscriber<T> {
    onSubscribe(subscription: Subscription): void;

    onNext(value: T): void;

    onError(error: any): void;

    onComplete(): void;

}

export interface Publisher<T> {
    subscribe(subscriber: Subscriber<T>): void
}


export interface Processor<T, R> extends Subscriber<T>, Publisher<R> {

}

export class ErrorPublisher<T> implements Publisher<T> {
    private readonly code: number
    private readonly error: any

    constructor(code: number, error: string) {
        this.code = code;
        this.error = error;
    }

    subscribe(subscriber: Subscriber<T>): void {
        subscriber.onError({code: this.code, message: this.error})
    }

}

export class DefaultQueueProcessor<T> implements Processor<T, T> {
    _subscriber: Subscriber<T> | undefined;

    onComplete(): void {
        this._subscriber?.onComplete();
    }

    onError(error: any): void {
        this._subscriber?.onError(error);
    }

    onNext(value: T): void {
        this._subscriber?.onNext(value);
    }

    onSubscribe(subscription: Subscription): void {
        this._subscriber?.onSubscribe(subscription);
    }

    subscribe(subscriber: Subscriber<T>): void {
        this._subscriber = subscriber;
    }

}

const defer = () => new Promise(resolve => setTimeout(resolve, 0));

export async function* publisherToAsyncIterator<T>(publisher: Publisher<T>) {
    let values: T[] = [];
    let error: any | undefined;
    let done: boolean = false;
    publisher.subscribe({
        onSubscribe: (subscription: Subscription) => void {},
        onNext: (data: T) => values.push(data),
        onError: (err: any) => error = err,
        onComplete: () => done = true
    });
    for (; ;) {
        if (values.length) {
            for (const value of values)
                yield value;
            values = [];
        }
        if (error) {
            throw error;
        }
        if (done) {
            return;
        }
        await defer();
    }
}

export function iteratorToPublisher<T>(iterator: Iterable<T>): Publisher<T> {
    return new class implements Publisher<T> {
        subscribe(subscriber: Subscriber<T>): void {
            for (const value of iterator) {
                subscriber.onNext(value)
            }
            subscriber.onComplete();
        }
    }
}

export async function asyncIteratorToPublisher<T>(iterator: AsyncIterable<T>): Promise<Publisher<T>> {
    return new class implements Publisher<T> {
        subscribe(subscriber: Subscriber<T>): void {
            (async function () {
                for await (const value of iterator) {
                    subscriber.onNext(value)
                }
            })().finally(() => {
                subscriber.onComplete();
            });
        }
    }
}
