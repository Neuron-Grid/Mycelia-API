import { Module } from "@nestjs/common";
import { DomainConfigModule } from "src/domain-config/domain-config.module";
import { JobsModule } from "src/jobs/jobs.module";
import { DailySummaryRepository } from "src/llm/infrastructure/repositories/daily-summary.repository";
import { LlmModule } from "src/llm/llm.module";
import { PodcastEpisodeRepository } from "src/podcast/infrastructure/podcast-episode.repository";
import { PodcastModule } from "src/podcast/podcast.module";
import { PodcastQueueModule } from "src/podcast/queue/podcast-queue.module";
import { UserSettingsRepository } from "src/shared/settings/user-settings.repository";
import { SupabaseAdminService } from "src/shared/supabase-admin.service";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { SettingsController } from "./settings.controller";

@Module({
    imports: [
        SupabaseRequestModule,
        JobsModule,
        LlmModule,
        PodcastModule,
        // podcastQueue のプロバイダを利用するため直接インポート
        PodcastQueueModule,
        DomainConfigModule,
    ],
    controllers: [SettingsController],
    providers: [
        UserSettingsRepository,
        DailySummaryRepository,
        PodcastEpisodeRepository,
        SupabaseAdminService,
    ],
})
export class SettingsModule {}
