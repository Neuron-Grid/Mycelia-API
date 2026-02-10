import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { DomainConfigModule } from "@/domain-config/domain-config.module";
import { JobsModule } from "@/jobs/jobs.module";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { SettingsController } from "./settings.controller";

// オプション機能の条件付きロード
const optionalSettingsImports: Array<import("@nestjs/common").Type> = [];
const optionalSettingsProviders: import("@nestjs/common").Provider[] = [];
if (process.env.ENABLE_OPTIONAL_MODULES !== "false") {
    /* eslint-disable @typescript-eslint/no-require-imports */
    optionalSettingsImports.push(
        require("@/llm/llm.module").LlmModule,
        require("@/podcast/podcast.module").PodcastModule,
        require("@/podcast/queue/podcast-queue.module").PodcastQueueModule,
    );
    optionalSettingsProviders.push(
        {
            provide: "DailySummaryRepository",
            useClass:
                require("@/llm/infrastructure/repositories/daily-summary.repository")
                    .DailySummaryRepository,
        },
        {
            provide: "PodcastEpisodeRepository",
            useClass:
                require("@/podcast/infrastructure/podcast-episode.repository")
                    .PodcastEpisodeRepository,
        },
    );
}

@Module({
    imports: [
        SupabaseRequestModule,
        AuthModule,
        JobsModule,
        DomainConfigModule,
        ...optionalSettingsImports,
    ],
    controllers: [SettingsController],
    providers: [UserSettingsRepository, ...optionalSettingsProviders],
})
export class SettingsModule {}
