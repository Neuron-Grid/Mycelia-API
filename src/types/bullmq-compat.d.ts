// Compatibility shim for @nestjs/bullmq expecting a named export `Processor` from 'bullmq'.
declare module "bullmq" {
    // Minimal shape to satisfy NestJS typings; actual generics are not used in our code.
    // If the upstream package already provides `Processor`, this declaration should be harmless
    // in practice for our compilation, but if it conflicts, remove this shim and align versions.
    export interface Job<T = unknown, R = unknown, N extends string = string> {
        id?: string | number;
        name: N;
        data: T;
        progress: number;
        returnvalue?: R;
        finishedOn?: number;
        processedOn?: number;
        timestamp?: number;
        failedReason?: string;
        updateProgress(progress: number | object): Promise<void>;
        discard(): Promise<void>;
        retry(): Promise<void>;
        getState(): Promise<string>;
        remove(options?: { removeChildren?: boolean }): Promise<void>;
    }

    export type Processor<
        T = unknown,
        R = unknown,
        N extends string = string,
    > = (job: Job<T, R, N>) => R | Promise<R>;

    export class Queue<T = unknown, R = unknown, N extends string = string> {
        constructor(name: string, opts?: unknown);
        add(name: N, data: T, opts?: unknown): Promise<Job<T, R, N>>;
        addBulk(
            jobs: Array<{ name: N; data: T; opts?: unknown }>,
        ): Promise<Job<T, R, N>[]>;
        clean(
            grace: number,
            limit?: number,
            type?: string,
        ): Promise<Job<T, R, N>[]>;
        getJobs(types: string[]): Promise<Job<T, R, N>[]>;
        getWaiting(start?: number, end?: number): Promise<Job<T, R, N>[]>;
        getFailed(start?: number, end?: number): Promise<Job<T, R, N>[]>;
        getActive(start?: number, end?: number): Promise<Job<T, R, N>[]>;
        getCompleted(start?: number, end?: number): Promise<Job<T, R, N>[]>;
        getDelayed(start?: number, end?: number): Promise<Job<T, R, N>[]>;
        getJob(id: string | number): Promise<Job<T, R, N> | null>;
        getJobCounts(): Promise<Record<string, number>>;
        remove(
            jobId: string | number,
            options?: { removeChildren?: boolean },
        ): Promise<number>;
        waitUntilReady(): Promise<void>;
    }

    export class FlowProducer {
        constructor(opts?: unknown);
        add(flow: { [key: string]: unknown }): Promise<{
            job: { id: string | number };
        }>;
        close(): Promise<void>;
    }
}
