import "@/setup/nestia";
import { Module } from "@nestjs/common";
import { EnvModule } from "@/config/env.module";
import { AuditLogModule } from "@/shared/audit/audit-log.module";
import { SupabaseAdminModule } from "@/shared/supabase-admin.module";
import { TimeModule } from "@/shared/time/time.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { FavoriteModule } from "./favorite/favorite.module";
import { FeedModule } from "./feed/feed.module";
import { JobsModule } from "./jobs/jobs.module";
import { SettingsModule } from "./settings/settings.module";
import { SupabaseRequestModule } from "./supabase-request.module";
import { TagModule } from "./tag/tag.module";

// オプション機能の条件付きロード
const optionalModules: Array<import("@nestjs/common").Type> = [];
if (process.env.ENABLE_OPTIONAL_MODULES !== "false") {
    /* eslint-disable @typescript-eslint/no-require-imports */
    optionalModules.push(
        require("./embedding/embedding.module").EmbeddingModule,
        require("./llm/llm.module").LlmModule,
        require("./podcast/podcast.module").PodcastModule,
        require("./search/search.module").SearchModule,
        require("./summary/summary.module").SummaryModule,
    );
}

@Module({
    imports: [
        EnvModule,
        SupabaseRequestModule,
        TimeModule,
        // コアモジュール
        FeedModule,
        AuthModule,
        TagModule,
        FavoriteModule,
        // オプション機能（ENABLE_OPTIONAL_MODULES=false で無効化可能）
        ...optionalModules,
        // 共通モジュール
        JobsModule,
        SettingsModule,
        AuditLogModule,
        SupabaseAdminModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppApiModule {}
