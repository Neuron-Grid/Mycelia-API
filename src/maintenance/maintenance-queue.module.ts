import type { QueueOptionsLike } from "@nestjs/bullmq";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AccountDeletionModule } from "@/account-deletion/account-deletion.module";
import { AuthModule } from "@/auth/auth.module";
import { IS_WORKER_APP } from "@/config/runtime.constants";
import { FeedQueueModule } from "@/feed/queue/feed-queue.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { RedisService } from "@/shared/redis/redis.service";
import { WorkerUserSettingsRepository } from "@/shared/settings/worker-user-settings.repository";
import { TimeModule } from "@/shared/time/time.module";
import { MaintenanceService } from "./maintenance.service";
import { MaintenanceQueueProcessor } from "./maintenance-queue.processor";

const optionalEnabled = process.env.ENABLE_OPTIONAL_MODULES !== "false";

// オプション機能の条件付きロード（Worker時のみ）
const optionalWorkerImports: Array<import("@nestjs/common").Type> = [];
if (IS_WORKER_APP && optionalEnabled) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    optionalWorkerImports.push(
        require("@/llm/llm.module").LlmModule,
        require("@/podcast/queue/podcast-queue.module").PodcastQueueModule,
        require("@/embedding/embedding.module").EmbeddingModule,
    );
}

const workerImports = IS_WORKER_APP
    ? [
        AuthModule,
        TimeModule,
        FeedQueueModule,
        AccountDeletionModule,
        ...optionalWorkerImports,
    ]
    : [];

const workerProviders = IS_WORKER_APP
    ? [
        WorkerUserSettingsRepository,
        MaintenanceService,
        MaintenanceQueueProcessor,
    ]
    : [];

@Module({
    imports: [
        RedisModule,
        BullModule.registerQueueAsync({
            name: "maintenanceQueue",
            imports: [RedisModule],
            useFactory: (redis: RedisService): QueueOptionsLike => ({
                connection: redis.createBullClient(),
                defaultJobOptions: {
                    attempts: 2,
                    backoff: { type: "fixed", delay: 30_000 },
                    removeOnComplete: 5,
                    removeOnFail: 5,
                },
            }),
            inject: [RedisService],
        }),
        ...workerImports,
    ],
    providers: workerProviders,
    exports: [BullModule],
})
export class MaintenanceQueueModule {}
