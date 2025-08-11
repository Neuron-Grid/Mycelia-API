import { Module } from "@nestjs/common";
import { LlmModule } from "src/llm/llm.module";
import { CloudflareR2Service } from "src/podcast/cloudflare-r2.service";
import { PodcastConfigRepository } from "src/podcast/infrastructure/podcast-config.repository";
import { PodcastEpisodeRepository } from "src/podcast/infrastructure/podcast-episode.repository";
import { PodcastTtsService } from "src/podcast/podcast-tts.service";
import { SearchModule } from "src/search/search.module";
import { SupabaseRequestModule } from "src/supabase-request.module";

// Podcast機能のコア依存（TTS/R2/Repos）をまとめ、
// Queue側とAPI側の両方がこのモジュールにのみ依存することで循環を断つ。
@Module({
    imports: [
        SupabaseRequestModule,
        // DailySummaryRepository などの依存を再エクスポートするために読み込む
        LlmModule,
        // EmbeddingService を再エクスポートするために読み込む
        SearchModule,
    ],
    providers: [
        PodcastTtsService,
        CloudflareR2Service,
        PodcastConfigRepository,
        PodcastEpisodeRepository,
    ],
    exports: [
        // 自前のプロバイダ
        PodcastTtsService,
        CloudflareR2Service,
        PodcastConfigRepository,
        PodcastEpisodeRepository,
        // 下位モジュールのプロバイダを利用側へ見せる
        LlmModule,
        SearchModule,
    ],
})
export class PodcastCoreModule {}
