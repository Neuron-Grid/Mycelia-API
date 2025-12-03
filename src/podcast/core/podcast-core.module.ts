import { Module } from "@nestjs/common";
import { IS_WORKER_APP } from "@/config/runtime.constants";
import { LlmModule } from "@/llm/llm.module";
import { CloudflareR2Service } from "@/podcast/cloudflare-r2.service";
import { PodcastConfigRepository } from "@/podcast/infrastructure/podcast-config.repository";
import { PodcastEpisodeRepository } from "@/podcast/infrastructure/podcast-episode.repository";
import { PodcastTtsService } from "@/podcast/podcast-tts.service";
import { SearchModule } from "@/search/search.module";
import { SearchWorkerModule } from "@/search/search.worker.module";
import { SupabaseRequestModule } from "@/supabase-request.module";

const searchModule = IS_WORKER_APP ? SearchWorkerModule : SearchModule;
const apiOnlyImports = IS_WORKER_APP ? [] : [SupabaseRequestModule];
const apiOnlyProviders = IS_WORKER_APP
    ? []
    : [PodcastConfigRepository, PodcastEpisodeRepository];
const apiOnlyExports = apiOnlyProviders;

// Podcast機能のコア依存（TTS/R2/Repos）をまとめ、
// Queue側とAPI側の両方がこのモジュールにのみ依存することで循環を断つ。
@Module({
    imports: [
        ...apiOnlyImports,
        // DailySummaryRepository などの依存を再エクスポートするために読み込む
        LlmModule,
        // EmbeddingService を再エクスポートするために読み込む
        searchModule,
    ],
    providers: [PodcastTtsService, CloudflareR2Service, ...apiOnlyProviders],
    exports: [
        // 自前のプロバイダ
        PodcastTtsService,
        CloudflareR2Service,
        ...apiOnlyExports,
        // 下位モジュールのプロバイダを利用側へ見せる
        LlmModule,
        searchModule,
    ],
})
export class PodcastCoreModule {}
