// @file システムヘルスチェックAPIのNestJSモジュール
// @module
// @public
// @since 1.0.0
// @see ./health.controller

import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EmbeddingQueueModule } from "src/embedding/queue/embedding-queue.module";
import { FeedQueueModule } from "src/feed/queue/feed-queue.module";
import { LlmModule } from "src/llm/llm.module";
import { PodcastQueueModule } from "src/podcast/queue/podcast-queue.module";
import { RedisModule } from "src/shared/redis/redis.module";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { HealthController } from "./health.controller";

@Module({
    imports: [
        SupabaseRequestModule,
        FeedQueueModule,
        RedisModule,
        LlmModule,
        PodcastQueueModule,
        EmbeddingQueueModule,
        // BullModule is re-exported from the modules above to enable queue injection
        BullModule,
    ],
    controllers: [HealthController],
})
export class HealthModule {}
