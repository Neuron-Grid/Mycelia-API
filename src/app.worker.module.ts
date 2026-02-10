import "@/setup/nestia";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { EnvModule } from "@/config/env.module";
import { FeedQueueModule } from "@/feed/queue/feed-queue.module";
import { JobsModule } from "@/jobs/jobs.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { SupabaseAdminModule } from "@/shared/supabase-admin.module";
import { TimeModule } from "@/shared/time/time.module";
import { SupabaseRequestModule } from "@/supabase-request.module";

// オプション機能の条件付きロード
const optionalWorkerModules: Array<import("@nestjs/common").Type> = [];
if (process.env.ENABLE_OPTIONAL_MODULES !== "false") {
    /* eslint-disable @typescript-eslint/no-require-imports */
    optionalWorkerModules.push(
        require("@/embedding/queue/embedding-queue.module")
            .EmbeddingQueueModule,
        require("@/llm/llm.module").LlmModule,
        require("@/podcast/queue/podcast-queue.module").PodcastQueueModule,
    );
}

@Module({
    imports: [
        EnvModule,
        ScheduleModule.forRoot(),
        SupabaseRequestModule,
        RedisModule,
        SupabaseAdminModule,
        TimeModule,
        // コアワーカーモジュール
        FeedQueueModule,
        JobsModule,
        // オプション（ENABLE_OPTIONAL_MODULES=false で無効化可能）
        ...optionalWorkerModules,
    ],
})
export class AppWorkerModule {}
