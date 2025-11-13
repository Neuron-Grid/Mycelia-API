import "@/setup/nestia";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { EnvModule } from "@/config/env.module";
import { EmbeddingQueueModule } from "@/embedding/queue/embedding-queue.module";
import { FeedQueueModule } from "@/feed/queue/feed-queue.module";
import { JobsModule } from "@/jobs/jobs.module";
import { LlmModule } from "@/llm/llm.module";
import { PodcastQueueModule } from "@/podcast/queue/podcast-queue.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { SupabaseAdminModule } from "@/shared/supabase-admin.module";
import { TimeModule } from "@/shared/time/time.module";
import { SupabaseRequestModule } from "@/supabase-request.module";

@Module({
    imports: [
        EnvModule,
        ScheduleModule.forRoot(),
        SupabaseRequestModule,
        RedisModule,
        SupabaseAdminModule,
        TimeModule,
        // Worker-specific modules
        FeedQueueModule,
        PodcastQueueModule,
        EmbeddingQueueModule,
        LlmModule,
        JobsModule,
    ],
})
export class AppWorkerModule {}
