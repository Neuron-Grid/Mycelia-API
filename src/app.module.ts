import "@/setup/nestia";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { validateEnv } from "@/config/env.validation";
import { AuditLogModule } from "@/shared/audit/audit-log.module";
import { SupabaseAdminModule } from "@/shared/supabase-admin.module";
import { TimeModule } from "@/shared/time/time.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { EmbeddingModule } from "./embedding/embedding.module";
import { FavoriteModule } from "./favorite/favorite.module";
import { FeedModule } from "./feed/feed.module";
import { FeedQueueModule } from "./feed/queue/feed-queue.module";
import { JobsModule } from "./jobs/jobs.module";
import { LlmModule } from "./llm/llm.module";
import { PodcastModule } from "./podcast/podcast.module";
import { PodcastQueueModule } from "./podcast/queue/podcast-queue.module";
import { SearchModule } from "./search/search.module";
import { SettingsModule } from "./settings/settings.module";
import { SummaryModule } from "./summary/summary.module";
import { SupabaseRequestModule } from "./supabase-request.module";
import { TagModule } from "./tag/tag.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnv,
        }),
        SupabaseRequestModule,
        TimeModule,
        // FeedModuleを読み込み
        FeedModule,
        // AuthModule (認証周り)
        AuthModule,
        ScheduleModule.forRoot(),
        FeedQueueModule,
        TagModule,
        FavoriteModule,
        // ポッドキャスト機能
        PodcastModule,
        PodcastQueueModule,
        // LLM (Gemini) 機能
        LlmModule,
        // ベクトル検索機能
        SearchModule,
        // ベクトル埋め込みバッチ処理機能
        EmbeddingModule,
        // Summary Module
        SummaryModule,
        // Daily jobs scheduler (BullMQ repeatable)
        JobsModule,
        SettingsModule,
        AuditLogModule,
        SupabaseAdminModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
