import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EmbeddingModule } from "src/embedding/embedding.module";
import { FavoriteRepository } from "src/favorite/infrastructure/favorite.repository";
import { SupabaseRequestModule } from "src/supabase-request.module";
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
import { FeedQueueService } from "./feed-queue.service";

@Module({
    imports: [
        SupabaseRequestModule,
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
        FeedQueueService,
        FeedUseCaseService,
        SubscriptionService,
        FeedItemService,
        FeedFetchService,
        SubscriptionRepository,
        FeedItemRepository,
        FavoriteRepository,
        TagRepository,
    ],
    exports: [FeedQueueService, BullModule],
})
export class FeedQueueModule {}
