import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { IS_WORKER_APP } from "@/config/runtime.constants";
import { FeedQueueModule } from "@/feed/queue/feed-queue.module";
import { BullmqMetricsController } from "@/jobs/bullmq-metrics.controller";
import { BullmqSupervisorService } from "@/jobs/bullmq-supervisor.service";
import { FlowOrchestratorService } from "@/jobs/flow-orchestrator.service";
import { JobsService } from "@/jobs/jobs.service";
import { JobsAdminController } from "@/jobs/jobs-admin.controller";
import { MaintenanceQueueModule } from "@/maintenance/maintenance-queue.module";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import { TimeModule } from "@/shared/time/time.module";
import { SupabaseRequestModule } from "@/supabase-request.module";

const controllers = IS_WORKER_APP
    ? []
    : [JobsAdminController, BullmqMetricsController];

// オプション機能の条件付きロード
const optionalJobImports: Array<import("@nestjs/common").Type> = [];
if (process.env.ENABLE_OPTIONAL_MODULES !== "false") {
    /* eslint-disable @typescript-eslint/no-require-imports */
    optionalJobImports.push(
        require("@/llm/llm.module").LlmModule,
        require("@/embedding/embedding.module").EmbeddingModule,
        require("@/podcast/queue/podcast-queue.module").PodcastQueueModule,
    );
}

@Module({
    imports: [
        SupabaseRequestModule,
        AuthModule,
        TimeModule,
        FeedQueueModule,
        MaintenanceQueueModule,
        ...optionalJobImports,
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
