import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EmbeddingModule } from "src/embedding/embedding.module";
import { SubscriptionAdminRepository } from "src/feed/infrastructure/subscription-admin.repository";
import { WorkerFeedItemRepository } from "src/feed/infrastructure/worker-feed-item.repository";
import { WorkerSubscriptionRepository } from "src/feed/infrastructure/worker-subscription.repository";
import { SupabaseAdminService } from "src/shared/supabase-admin.service";
import { RedisModule } from "../../shared/redis/redis.module";
import { RedisService } from "../../shared/redis/redis.service";
import { FeedFetchService } from "../application/feed-fetch.service";
import { FeedUseCaseService } from "../application/feed-usecase.service";
import { FeedQueueProcessor } from "./feed-queue.processor";
import { FeedQueueScanProcessor } from "./feed-queue.scan.processor";
import { FeedQueueService } from "./feed-queue.service";

@Module({
    imports: [
        EmbeddingModule,
        RedisModule,
        BullModule.registerQueueAsync({
            name: "feedQueue",
            imports: [RedisModule],
            // RedisService側で用意した共通ioredisインスタンスを共有する。
            useFactory: (redisService: RedisService) => ({
                connection: redisService.createBullClient(),
            }),
            inject: [RedisService],
        }),
    ],
    providers: [
        FeedQueueProcessor,
        FeedQueueScanProcessor,
        FeedQueueService,
        FeedUseCaseService,
        FeedFetchService,
        SubscriptionAdminRepository,
        WorkerSubscriptionRepository,
        WorkerFeedItemRepository,
        SupabaseAdminService,
    ],
    exports: [
        FeedQueueService,
        BullModule,
        // Export worker repositories so FeedModule can inject them
        WorkerSubscriptionRepository,
        WorkerFeedItemRepository,
    ],
})
export class FeedQueueModule {}
