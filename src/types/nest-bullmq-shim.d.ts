declare module "@nestjs/bullmq" {
    // Minimal queue options shape used in our app
    export interface QueueOptionsLike {
        connection?: unknown;
        defaultJobOptions?: {
            attempts?: number;
            backoff?: unknown;
            removeOnComplete?: boolean | number;
            removeOnFail?: boolean | number;
        };
        limiter?: {
            max?: number;
            duration?: number;
            groupKey?: string;
        };
    }

    export interface QueueRegisterOptions {
        name: string;
        imports?: unknown[];
        // Method-style to enable bivariant parameter checking
        useFactory?(...args: unknown[]): QueueOptionsLike;
        inject?: unknown[];
    }

    export const JOB_REF: "REQUEST";
    export function getQueueToken(name?: string): string;

    /* biome-ignore lint/complexity/noStaticOnlyClass: shim aligns with NestJS API */
    export class BullModule {
        static registerQueueAsync(
            ...options: QueueRegisterOptions[]
        ): import("@nestjs/common").DynamicModule;
    }
    export function InjectQueue(name?: string): ParameterDecorator;

    export interface NestWorkerOptions {
        concurrency?: number;
    }

    export function Processor(
        queueOrOptions?: string | { name?: string },
        workerOptions?: NestWorkerOptions,
    ): ClassDecorator;

    export abstract class WorkerHost {
        abstract process(
            job: import("bullmq").Job<unknown, unknown, string>,
        ): unknown | Promise<unknown>;
    }
}
