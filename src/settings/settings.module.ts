import { Module } from "@nestjs/common";
import { DomainConfigModule } from "@/domain-config/domain-config.module";
import { JobsModule } from "@/jobs/jobs.module";
import { DailySummaryRepository } from "@/llm/infrastructure/repositories/daily-summary.repository";
import { LlmModule } from "@/llm/llm.module";
import { PodcastEpisodeRepository } from "@/podcast/infrastructure/podcast-episode.repository";
import { PodcastModule } from "@/podcast/podcast.module";
import { PodcastQueueModule } from "@/podcast/queue/podcast-queue.module";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { SupabaseRequestModule } from "@/supabase-request.module";
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
