// @deno-types="https://deno.land/x/types/rxjs/v6.5.5/rxjs.d.ts"
import {Observable} from "https://cdn.pika.dev/rxjs@6.5.5";
import {observableToPublisher, publisherToObservable} from "../../reactivestreams/rxjs.ts";
import {asyncIteratorToPublisher, iteratorToPublisher, Publisher, Subscription} from "../../reactivestreams/mod.ts";

Deno.test("test publisherToObservable", () => {
    let publisher = iteratorToPublisher(["first", "second"])
    let foo = publisherToObservable(publisher);
    foo.subscribe((x: any) => {
        console.log(x);
    });
});

async function* asyncIterator() {
    yield 1;
    yield* [2, 3];
    yield* (async function* () {
        yield 4;
    })();
}

Deno.test("test asyncIteratorToPublisher", async () => {
    let iterator = asyncIterator();
    let publisher = asyncIteratorToPublisher(iterator);
    let foo = publisherToObservable(publisher);
    foo.subscribe((x: any) => {
        console.log(x);
    });
});

Deno.test("test observableToPublisher", () => {
    const observable = new Observable(subscriber => {
        subscriber.next("first");
        subscriber.next("second");
        subscriber.next("three");
        subscriber.complete();
    });
    let publisher = observableToPublisher(observable);
    publisher.subscribe({
        onSubscribe: (subscription: Subscription) => void {},
        onNext: (data) => {
            console.log(data);
        },
        onError: (err: any) => void {},
        onComplete: () => void {}
    });
});
