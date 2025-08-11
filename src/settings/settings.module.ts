import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { DomainConfigModule } from "src/domain-config/domain-config.module";
import { JobsModule } from "src/jobs/jobs.module";
import { DailySummaryRepository } from "src/llm/infrastructure/repositories/daily-summary.repository";
import { LlmModule } from "src/llm/llm.module";
import { PodcastEpisodeRepository } from "src/podcast/infrastructure/podcast-episode.repository";
import { PodcastModule } from "src/podcast/podcast.module";
import { UserSettingsRepository } from "src/shared/settings/user-settings.repository";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { SettingsController } from "./settings.controller";

@Module({
    imports: [
        SupabaseRequestModule,
        JobsModule,
        // キューをコントローラで参照
        BullModule.registerQueue({ name: "summary-generate" }),
        BullModule.registerQueue({ name: "script-generate" }),
        BullModule.registerQueue({ name: "podcastQueue" }),
        LlmModule,
        PodcastModule,
        DomainConfigModule,
    ],
    controllers: [SettingsController],
    providers: [
        UserSettingsRepository,
        DailySummaryRepository,
        PodcastEpisodeRepository,
    ],
})
export class SettingsModule {}
