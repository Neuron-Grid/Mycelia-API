import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AccountDeletionModule } from "@/account-deletion/account-deletion.module";
import { EmbeddingModule } from "@/embedding/embedding.module";
import { FeedQueueModule } from "@/feed/queue/feed-queue.module";
import { LlmModule } from "@/llm/llm.module";
import { PodcastQueueModule } from "@/podcast/queue/podcast-queue.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { RedisService } from "@/shared/redis/redis.service";
import { WorkerUserSettingsRepository } from "@/shared/settings/worker-user-settings.repository";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { MaintenanceService } from "./maintenance.service";
import { MaintenanceQueueProcessor } from "./maintenance-queue.processor";

@Module({
    imports: [
        RedisModule,
        // 各キューのQueueトークンを解決するためインポート
        LlmModule,
        PodcastQueueModule,
        FeedQueueModule,
        EmbeddingModule,
        AccountDeletionModule,
        BullModule.registerQueueAsync({
            name: "maintenanceQueue",
            imports: [RedisModule],
            useFactory: (redis: RedisService) => ({
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
    ],
    providers: [
        SupabaseAdminService,
        WorkerUserSettingsRepository,
        MaintenanceService,
        MaintenanceQueueProcessor,
    ],
    exports: [BullModule],
})
export class MaintenanceQueueModule {}
