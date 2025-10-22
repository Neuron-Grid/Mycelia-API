import type { QueueOptionsLike } from "@nestjs/bullmq";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { WorkerDailySummaryRepository } from "@/llm/infrastructure/repositories/worker-daily-summary.repository";
import { PodcastCoreModule } from "@/podcast/core/podcast-core.module";
import { WorkerPodcastEpisodeRepository } from "@/podcast/infrastructure/worker-podcast-episode.repository";
import { PodcastQueueProcessor } from "@/podcast/queue/podcast-queue.processor";
import { PodcastQueueService } from "@/podcast/queue/podcast-queue.service";
import { DistributedLockModule } from "@/shared/lock/distributed-lock.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { RedisService } from "@/shared/redis/redis.service";
import { WorkerUserSettingsRepository } from "@/shared/settings/worker-user-settings.repository";

@Module({
    imports: [
        RedisModule,
        AuthModule,
        DistributedLockModule,
        // Queue側はPodcastModuleには依存せず、Coreにのみ依存させる
        PodcastCoreModule,
        BullModule.registerQueueAsync({
            name: "podcastQueue",
            imports: [RedisModule],
            // RedisService側で用意した共通ioredisインスタンスを共有する
            useFactory: (redisService: RedisService): QueueOptionsLike => ({
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
    ],
    exports: [PodcastQueueService, BullModule],
})
export class PodcastQueueModule {}
