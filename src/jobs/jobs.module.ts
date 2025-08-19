import { Module } from "@nestjs/common";
import { EmbeddingModule } from "src/embedding/embedding.module";
import { FeedQueueModule } from "src/feed/queue/feed-queue.module";
import { LlmModule } from "src/llm/llm.module";
import { MaintenanceQueueModule } from "src/maintenance/maintenance-queue.module";
import { PodcastQueueModule } from "src/podcast/queue/podcast-queue.module";
import { UserSettingsRepository } from "src/shared/settings/user-settings.repository";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { FlowOrchestratorService } from "./flow-orchestrator.service";
import { JobsService } from "./jobs.service";
import { JobsAdminController } from "./jobs-admin.controller";

@Module({
    imports: [
        SupabaseRequestModule,
        LlmModule,
        EmbeddingModule,
        PodcastQueueModule,
        FeedQueueModule,
        MaintenanceQueueModule,
    ],
    controllers: [JobsAdminController],
    providers: [JobsService, UserSettingsRepository, FlowOrchestratorService],
    exports: [JobsService, FlowOrchestratorService],
})
export class JobsModule {}
