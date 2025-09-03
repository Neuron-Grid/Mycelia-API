import { TypedBody, TypedRoute } from "@nestia/core";
import { Controller, UseGuards } from "@nestjs/common";
import { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { SupabaseUser } from "@/auth/supabase-user.decorator";
import { buildResponse } from "@/common/utils/response.util";
import { SummaryService } from "@/summary/application/summary.service";
import { CreateSummaryDto } from "@/summary/dto/create-summary.dto";

@Controller("summary")
@UseGuards(SupabaseAuthGuard)
export class SummaryController {
    constructor(private readonly summaryService: SummaryService) {}

    /** Create a new summary */
    @TypedRoute.Post("")
    async createSummary(
        @SupabaseUser() user: User,
        @TypedBody() createSummaryDto: CreateSummaryDto,
    ) {
        const result = await this.summaryService.createSummary(
            user.id,
            createSummaryDto,
        );
        return buildResponse("Summary created", result);
    }
}
