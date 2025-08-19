import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EmbeddingModule } from "src/embedding/embedding.module";
import { FeedQueueModule } from "src/feed/queue/feed-queue.module";
import { LlmModule } from "src/llm/llm.module";
import { PodcastQueueModule } from "src/podcast/queue/podcast-queue.module";
import { RedisModule } from "src/shared/redis/redis.module";
import { RedisService } from "src/shared/redis/redis.service";
import { UserSettingsRepository } from "src/shared/settings/user-settings.repository";
import { SupabaseAdminService } from "src/shared/supabase-admin.service";
import { AccountDeletionModule } from "@/account-deletion/account-deletion.module";
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
        UserSettingsRepository,
        MaintenanceService,
        MaintenanceQueueProcessor,
    ],
    exports: [BullModule],
})
export class MaintenanceQueueModule {}
