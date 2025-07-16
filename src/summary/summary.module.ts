import { Module } from "@nestjs/common";
import { AuthModule } from "src/auth/auth.module";
import { LlmModule } from "../llm/llm.module";
import { PodcastModule } from "../podcast/podcast.module";
import { SupabaseRequestModule } from "../supabase-request.module";
import { SummaryController } from "./application/summary.controller";
import { SummaryService } from "./application/summary.service";
import { SummaryRepository } from "./infrastructure/summary.repository";

@Module({
    imports: [SupabaseRequestModule, LlmModule, AuthModule, PodcastModule],
    controllers: [SummaryController],
    providers: [SummaryService, SummaryRepository],
})
export class SummaryModule {}
