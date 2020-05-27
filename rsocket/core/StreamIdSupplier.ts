export class StreamIdSupplier {
    private static MASK = 0x7FFFFFFF
    private streamId: number;
    private readonly initialValue: number;

    constructor(streamId: number) {
        this.streamId = streamId;
        this.initialValue = streamId;
    }

    public static clientSupplier(): StreamIdSupplier {
        return new StreamIdSupplier(-1);
    }

    public static serverSupplier(): StreamIdSupplier {
        return new StreamIdSupplier(0);
    }

    public nextStreamId(streamIds: Map<number, any>): number {
        let nextStreamId;
        do {
            this.streamId += 2;
            //Fix Number.MAX_SAFE_INTEGER overflow problem
            if (this.streamId > StreamIdSupplier.MASK) {
                this.streamId = this.initialValue + 2;
            }
            nextStreamId = this.streamId;
        } while (nextStreamId == 0 || streamIds.has(nextStreamId));
        return nextStreamId;
    }
}
