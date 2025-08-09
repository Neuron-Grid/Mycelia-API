import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { SUMMARY_GENERATE_QUEUE } from "src/llm/application/services/summary-script.service";
import { LlmModule } from "src/llm/llm.module";
import { MaintenanceQueueModule } from "src/maintenance/maintenance-queue.module";
import { PodcastQueueModule } from "src/podcast/queue/podcast-queue.module";
import { UserSettingsRepository } from "src/shared/settings/user-settings.repository";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { JobsService } from "./jobs.service";

@Module({
    imports: [
        SupabaseRequestModule,
        LlmModule,
        PodcastQueueModule,
        // Ensure queues are available for injection
        BullModule.registerQueue({ name: SUMMARY_GENERATE_QUEUE }),
        BullModule.registerQueue({ name: "podcastQueue" }),
        MaintenanceQueueModule,
    ],
    providers: [JobsService, UserSettingsRepository],
    exports: [JobsService],
})
export class JobsModule {}
