// Allow passing `concurrency` to @Processor decorator options
declare module "@nestjs/bullmq" {
    interface NestWorkerOptions {
        concurrency?: number;
    }
}
