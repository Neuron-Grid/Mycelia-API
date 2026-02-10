import type { QueueOptionsLike } from "@nestjs/bullmq";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { IS_WORKER_APP } from "@/config/runtime.constants";
import { EmbeddingQueueModule } from "@/embedding/queue/embedding-queue.module";
import { SubscriptionAdminRepository } from "@/feed/infrastructure/subscription-admin.repository";
import { WorkerFeedItemRepository } from "@/feed/infrastructure/worker-feed-item.repository";
import { WorkerSubscriptionRepository } from "@/feed/infrastructure/worker-subscription.repository";
import { RedisModule } from "../../shared/redis/redis.module";
import { RedisService } from "../../shared/redis/redis.service";
import { FeedFetchService } from "../application/feed-fetch.service";
import { FeedUseCaseService } from "../application/feed-usecase.service";
import { FeedQueueProcessor } from "./feed-queue.processor";
import { FeedQueueScanProcessor } from "./feed-queue.scan.processor";
import { FeedQueueService } from "./feed-queue.service";

const optionalEnabled = process.env.ENABLE_OPTIONAL_MODULES !== "false";
const workerImports =
    IS_WORKER_APP && optionalEnabled ? [EmbeddingQueueModule] : [];
const workerProviders = IS_WORKER_APP
    ? [
          FeedQueueProcessor,
          FeedQueueScanProcessor,
          FeedUseCaseService,
          FeedFetchService,
          SubscriptionAdminRepository,
      ]
    : [];

@Module({
    imports: [
        RedisModule,
        BullModule.registerQueueAsync({
            name: "feedQueue",
            imports: [RedisModule],
            // RedisService側で用意した共通ioredisインスタンスを共有する。
            useFactory: (redisService: RedisService): QueueOptionsLike => ({
                connection: redisService.createBullClient(),
            }),
            inject: [RedisService],
        }),
        ...workerImports,
    ],
    providers: [
        FeedQueueService,
        WorkerSubscriptionRepository,
        WorkerFeedItemRepository,
        ...workerProviders,
    ],
    exports: [
        FeedQueueService,
        WorkerSubscriptionRepository,
        WorkerFeedItemRepository,
        BullModule,
    ],
})
export class FeedQueueModule {}
