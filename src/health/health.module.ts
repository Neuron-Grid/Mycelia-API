// @file システムヘルスチェックAPIのNestJSモジュール
// @module
// @public
// @since 1.0.0
// @see ./health.controller
import { Module } from "@nestjs/common";
import { FeedQueueModule } from "src/feed/queue/feed-queue.module";
import { RedisModule } from "src/shared/redis/redis.module";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { HealthController } from "./health.controller";

@Module({
    imports: [SupabaseRequestModule, FeedQueueModule, RedisModule],
    controllers: [HealthController],
})
export class HealthModule {}
