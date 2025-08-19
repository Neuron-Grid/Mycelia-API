import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EmbeddingModule } from "src/embedding/embedding.module";
import { FavoriteRepository } from "src/favorite/infrastructure/favorite.repository";
import { SubscriptionAdminRepository } from "src/feed/infrastructure/subscription-admin.repository";
import { WorkerFeedItemRepository } from "src/feed/infrastructure/worker-feed-item.repository";
import { WorkerSubscriptionRepository } from "src/feed/infrastructure/worker-subscription.repository";
import { SupabaseAdminService } from "src/shared/supabase-admin.service";
import { TagRepository } from "src/tag/infrastructure/tag.repository";
import { RedisModule } from "../../shared/redis/redis.module";
import { RedisService } from "../../shared/redis/redis.service";
import { FeedFetchService } from "../application/feed-fetch.service";
import { FeedItemService } from "../application/feed-item.service";
import { FeedUseCaseService } from "../application/feed-usecase.service";
import { SubscriptionService } from "../application/subscription.service";
import { FeedItemRepository } from "../infrastructure/feed-item.repository";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
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
        SubscriptionService,
        FeedItemService,
        FeedFetchService,
        SubscriptionRepository,
        SubscriptionAdminRepository,
        FeedItemRepository,
        WorkerSubscriptionRepository,
        WorkerFeedItemRepository,
        FavoriteRepository,
        TagRepository,
        SupabaseAdminService,
    ],
    exports: [FeedQueueService, BullModule],
})
export class FeedQueueModule {}
