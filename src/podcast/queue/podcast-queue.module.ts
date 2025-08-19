import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { WorkerDailySummaryRepository } from "src/llm/infrastructure/repositories/worker-daily-summary.repository";
import { PodcastCoreModule } from "src/podcast/core/podcast-core.module";
import { WorkerPodcastEpisodeRepository } from "src/podcast/infrastructure/worker-podcast-episode.repository";
import { PodcastQueueProcessor } from "src/podcast/queue/podcast-queue.processor";
import { PodcastQueueService } from "src/podcast/queue/podcast-queue.service";
import { DistributedLockModule } from "src/shared/lock/distributed-lock.module";
import { RedisModule } from "src/shared/redis/redis.module";
import { RedisService } from "src/shared/redis/redis.service";
import { WorkerUserSettingsRepository } from "src/shared/settings/worker-user-settings.repository";
import { SupabaseAdminService } from "src/shared/supabase-admin.service";

@Module({
    imports: [
        RedisModule,
        DistributedLockModule,
        // Queue側はPodcastModuleには依存せず、Coreにのみ依存させる
        PodcastCoreModule,
        BullModule.registerQueueAsync({
            name: "podcastQueue",
            imports: [RedisModule],
            // RedisService側で用意した共通ioredisインスタンスを共有する
            useFactory: (redisService: RedisService) => ({
                connection: redisService.createBullClient(),
                limiter: {
                    max: 30,
                    duration: 1000,
                    groupKey: "data.userId",
                },
            }),
            inject: [RedisService],
        }),
    ],
    providers: [
        PodcastQueueProcessor,
        PodcastQueueService,
        WorkerUserSettingsRepository,
        WorkerDailySummaryRepository,
        WorkerPodcastEpisodeRepository,
        SupabaseAdminService,
    ],
    exports: [PodcastQueueService, BullModule],
})
export class PodcastQueueModule {}
