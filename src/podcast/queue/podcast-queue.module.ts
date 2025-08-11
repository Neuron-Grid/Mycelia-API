import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { PodcastCoreModule } from "src/podcast/core/podcast-core.module";
import { PodcastQueueProcessor } from "src/podcast/queue/podcast-queue.processor";
import { PodcastQueueService } from "src/podcast/queue/podcast-queue.service";
import { DistributedLockModule } from "src/shared/lock/distributed-lock.module";
import { RedisModule } from "src/shared/redis/redis.module";
import { RedisService } from "src/shared/redis/redis.service";
import { UserSettingsRepository } from "src/shared/settings/user-settings.repository";
import { SupabaseRequestModule } from "src/supabase-request.module";

@Module({
    imports: [
        SupabaseRequestModule,
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
        UserSettingsRepository,
    ],
    exports: [PodcastQueueService, BullModule],
})
export class PodcastQueueModule {}
