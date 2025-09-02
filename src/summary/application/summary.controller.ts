import { TypedRoute } from "@nestia/core";
import { Body, Controller, UseGuards } from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { SupabaseUser } from "@/auth/supabase-user.decorator";
import { ErrorResponseDto } from "@/common/dto/error-response.dto";
import { buildResponse } from "@/common/utils/response.util";
import { SummaryService } from "@/summary/application/summary.service";
import { CreateSummaryDto } from "@/summary/dto/create-summary.dto";

@ApiTags("Summary")
@ApiBearerAuth()
@Controller("summary")
@UseGuards(SupabaseAuthGuard)
export class SummaryController {
    constructor(private readonly summaryService: SummaryService) {}

    @TypedRoute.Post()
    @ApiOperation({ summary: "Create a new summary" })
    @ApiCreatedResponse({
        description: "Returns { message, data: { summary, id? } }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "object",
                    properties: {
                        summary: { type: "string" },
                        id: { type: "number", nullable: true },
                    },
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad Request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    async createSummary(
        @SupabaseUser() user: User,
        @Body() createSummaryDto: CreateSummaryDto,
    ) {
        const result = await this.summaryService.createSummary(
            user.id,
            createSummaryDto,
        );
        return buildResponse("Summary created", result);
    }
}
