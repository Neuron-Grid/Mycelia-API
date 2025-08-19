import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { LlmModule } from "@/llm/llm.module";
import { PodcastModule } from "@/podcast/podcast.module";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { SummaryController } from "@/summary/application/summary.controller";
import { SummaryService } from "@/summary/application/summary.service";
import { SummaryRepository } from "@/summary/infrastructure/summary.repository";
import { SupabaseRequestModule } from "@/supabase-request.module";

@Module({
    imports: [SupabaseRequestModule, LlmModule, AuthModule, PodcastModule],
    controllers: [SummaryController],
    providers: [SummaryService, SummaryRepository, SupabaseAdminService],
})
export class SummaryModule {}
