import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { IS_WORKER_APP } from "@/config/runtime.constants";
import { EmbeddingModule } from "@/embedding/embedding.module";
import { FeedQueueModule } from "@/feed/queue/feed-queue.module";
import { BullmqMetricsController } from "@/jobs/bullmq-metrics.controller";
import { BullmqSupervisorService } from "@/jobs/bullmq-supervisor.service";
import { FlowOrchestratorService } from "@/jobs/flow-orchestrator.service";
import { JobsService } from "@/jobs/jobs.service";
import { JobsAdminController } from "@/jobs/jobs-admin.controller";
import { LlmModule } from "@/llm/llm.module";
import { MaintenanceQueueModule } from "@/maintenance/maintenance-queue.module";
import { PodcastQueueModule } from "@/podcast/queue/podcast-queue.module";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import { TimeModule } from "@/shared/time/time.module";
import { SupabaseRequestModule } from "@/supabase-request.module";

const controllers = IS_WORKER_APP
    ? []
    : [JobsAdminController, BullmqMetricsController];

@Module({
    imports: [
        SupabaseRequestModule,
        AuthModule,
        TimeModule,
        LlmModule,
        EmbeddingModule,
        PodcastQueueModule,
        FeedQueueModule,
        MaintenanceQueueModule,
    ],
    controllers,
    providers: [
        JobsService,
        UserSettingsRepository,
        FlowOrchestratorService,
        BullmqSupervisorService,
    ],
    exports: [JobsService, FlowOrchestratorService, BullmqSupervisorService],
})
export class JobsModule {}
