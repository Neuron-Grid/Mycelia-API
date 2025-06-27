import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "../../auth/supabase-auth.guard";
import { SupabaseUser } from "../../auth/supabase-user.decorator";
import { CreateSummaryDto } from "../dto/create-summary.dto";
import { SummaryService } from "./summary.service";

@ApiTags("Summary")
@ApiBearerAuth()
@Controller("api/v1/summary")
@UseGuards(SupabaseAuthGuard)
export class SummaryController {
    constructor(private readonly summaryService: SummaryService) {}

    @Post()
    @ApiOperation({ summary: "Create a new summary" })
    @ApiResponse({
        status: 201,
        description: "The summary has been successfully created.",
        type: Object,
    })
    @ApiResponse({ status: 400, description: "Bad Request." })
    @ApiResponse({ status: 401, description: "Unauthorized." })
    async createSummary(
        @SupabaseUser() user: User,
        @Body() createSummaryDto: CreateSummaryDto,
    ): Promise<{ summary: string; id?: number }> {
        const result = await this.summaryService.createSummary(
            user.id,
            createSummaryDto,
        );
        return result;
    }
}
