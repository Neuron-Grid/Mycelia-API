import { Module } from "@nestjs/common";
import { EmbeddingModule } from "@/embedding/embedding.module";
import { FeedQueueModule } from "@/feed/queue/feed-queue.module";
import { FlowOrchestratorService } from "@/jobs/flow-orchestrator.service";
import { JobsService } from "@/jobs/jobs.service";
import { JobsAdminController } from "@/jobs/jobs-admin.controller";
import { LlmModule } from "@/llm/llm.module";
import { MaintenanceQueueModule } from "@/maintenance/maintenance-queue.module";
import { PodcastQueueModule } from "@/podcast/queue/podcast-queue.module";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { SupabaseRequestModule } from "@/supabase-request.module";

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
    providers: [
        JobsService,
        UserSettingsRepository,
        FlowOrchestratorService,
        SupabaseAdminService,
    ],
    exports: [JobsService, FlowOrchestratorService],
})
export class JobsModule {}
