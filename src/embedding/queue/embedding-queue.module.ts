import type { QueueOptionsLike } from "@nestjs/bullmq";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { RedisService } from "@/shared/redis/redis.service";
import { SearchModule } from "../../search/search.module";
import { EMBEDDING_BATCH_CONFIG } from "../config/embedding-batch.config";
import { EmbeddingBatchDataService } from "../services/embedding-batch-data.service";
import { EmbeddingBatchUpdateService } from "../services/embedding-batch-update.service";
import { EmbeddingQueueProcessor } from "./embedding-queue.processor";
import { EmbeddingQueueService } from "./embedding-queue.service";

@Module({
    imports: [
        RedisModule,
        AuthModule,
        BullModule.registerQueueAsync({
            name: "embeddingQueue",
            imports: [RedisModule],
            useFactory: (redisService: RedisService): QueueOptionsLike => ({
                connection: redisService.createBullClient(),
                defaultJobOptions: {
                    removeOnComplete:
                        EMBEDDING_BATCH_CONFIG.queue.removeOnComplete,
                    removeOnFail: EMBEDDING_BATCH_CONFIG.queue.removeOnFail,
                    attempts: EMBEDDING_BATCH_CONFIG.queue.attempts,
                    backoff: {
                        type: "exponential",
                        delay: EMBEDDING_BATCH_CONFIG.queue.backoffDelay,
                    },
                },
            }),
            inject: [RedisService],
        }),
        SearchModule,
    ],
    providers: [
        EmbeddingQueueService,
        EmbeddingQueueProcessor,
        EmbeddingBatchDataService,
        EmbeddingBatchUpdateService,
    ],
    exports: [EmbeddingQueueService, BullModule],
})
export class EmbeddingQueueModule {}
