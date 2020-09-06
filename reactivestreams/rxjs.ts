import {Observable} from "https://dev.jspm.io/rxjs@6/_esm2015";
//import { map, filter, switchMap } from 'https://dev.jspm.io/rxjs@6/_esm2015/operators';

import {Publisher, Subscriber, Subscription} from "./mod.ts"

// @ts-ignore
export function publisherToObservable<T>(publisher: Publisher<T>): Observable<T> {
    return new Observable((subscriber: any) => {
        publisher.subscribe({
            onSubscribe: (subscription: Subscription) => void {},
            onNext: (data: T) => subscriber.next(data),
            onError: (err: any) => subscriber.error(err),
            onComplete: () => subscriber.complete()
        });
    });
}

// @ts-ignore
export function observableToPublisher<T>(observable: Observable<T>): Publisher<T> {
    return new class implements Publisher<T> {
        subscribe(subscriber: Subscriber<T>): void {
            observable.subscribe({
                next(x: T) {
                    subscriber.onNext(x);
                },
                error(err: any) {
                    subscriber.onError(err);
                },
                complete() {
                    subscriber.onComplete();
                }
            })
        }
    };
}
