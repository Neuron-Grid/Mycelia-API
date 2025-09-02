import { TypedRoute } from "@nestia/core";
import {
    Body,
    Controller,
    HttpException,
    HttpStatus,
    Logger,
    Param,
    UseGuards,
} from "@nestjs/common";
import {
    ApiAcceptedResponse,
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
    ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { User as SupabaseUserType } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { ErrorResponseDto } from "@/common/dto/error-response.dto";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import { RegenerateScriptDto } from "@/llm/application/dto/regenerate-script.dto";
import { RegenerateSummaryDto } from "@/llm/application/dto/regenerate-summary.dto";
import { SupabaseUser } from "../../../auth/supabase-user.decorator";
import { DailySummaryRepository } from "../../infrastructure/repositories/daily-summary.repository";
import { SummaryScriptService } from "../services/summary-script.service";

@ApiTags("Summary & Script Regeneration")
@Controller() // グローバルPrefix `api/v1` を利用（ベースパスは空）
export class SummaryController {
    private readonly logger = new Logger(SummaryController.name); // Loggerインスタンス

    constructor(
        private readonly summaryScriptService: SummaryScriptService,
        private readonly dailySummaryRepository: DailySummaryRepository,
    ) {}

    @TypedRoute.Post("summaries/users/:userId/regenerate") // パスをよりRESTfulに、summaryを複数形に
    @ApiOperation({
        summary:
            "Regenerate summary for a user (typically for today or a specific date)",
    })
    @ApiParam({
        name: "userId",
        description: "User ID for whom to regenerate summary",
        type: "string",
    })
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard)
    @ApiBody({ type: RegenerateSummaryDto })
    @ApiAcceptedResponse({
        description: "Returns { message, data: { jobId } }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "object",
                    properties: { jobId: { type: "string", nullable: true } },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @ApiForbiddenResponse({ description: "Forbidden", type: ErrorResponseDto })
    @ApiBadRequestResponse({
        description: "Bad Request",
        type: ErrorResponseDto,
    })
    @ApiInternalServerErrorResponse({
        description: "Server Error",
        type: ErrorResponseDto,
    })
    async regenerateSummary(
        @Param("userId") targetUserId: string,
        @SupabaseUser() requestingUser: SupabaseUserType,
        @Body() body?: RegenerateSummaryDto,
    ): Promise<SuccessResponse<{ jobId?: string }>> {
        // 戻り値の型を明確化
        this.logger.log(
            `User ${requestingUser.id} requesting summary regeneration for user ${targetUserId}`,
        );

        // 管理者ユーザーは不要なので、リクエスト発行者が対象ユーザーと一致する場合のみ許可
        if (requestingUser.id !== targetUserId) {
            this.logger.warn(
                `Forbidden: User ${requestingUser.id} attempted to regenerate summary for ${targetUserId}`,
            );
            throw new HttpException(
                "Forbidden: You can only regenerate your own summaries.",
                HttpStatus.FORBIDDEN,
            );
        }

        try {
            // SummaryScriptServiceのメソッドはBullMQのaddを呼び出し、Jobオブジェクト(またはその一部)を返す想定
            // Jobオブジェクトにはidが含まれる
            const result =
                await this.summaryScriptService.requestSummaryGeneration(
                    targetUserId,
                    body?.prompt,
                ); // await を追加
            const message = `Summary regeneration job (ID: ${result.jobId}) has been queued for user ${targetUserId} (date: ${body?.date || "today"}).`;
            this.logger.log(message);
            return buildResponse("Summary regeneration queued", {
                jobId: result.jobId,
            });
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred";
            this.logger.error(
                `Failed to queue summary regeneration for user ${targetUserId}: ${errorMessage}`,
                error instanceof Error ? error.stack : undefined,
            );
            throw new HttpException(
                "Failed to queue summary regeneration.",
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @TypedRoute.Post("scripts/summaries/:summaryId/regenerate") // パスをよりRESTfulに、scriptを複数形、summaryを複数形に
    @ApiOperation({ summary: "Regenerate script_text for a specific summary" })
    @ApiParam({
        name: "summaryId",
        description: "ID of the daily_summary to regenerate script for",
        type: "number",
    })
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard)
    @ApiBody({ type: RegenerateScriptDto })
    @ApiAcceptedResponse({
        description: "Returns { message, data: { jobId } }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "object",
                    properties: { jobId: { type: "string", nullable: true } },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @ApiForbiddenResponse({ description: "Forbidden", type: ErrorResponseDto })
    @ApiBadRequestResponse({
        description: "Bad Request",
        type: ErrorResponseDto,
    })
    @ApiInternalServerErrorResponse({
        description: "Server Error",
        type: ErrorResponseDto,
    })
    async regenerateScript(
        @Param("summaryId") summaryIdParam: string, // パラメータは文字列で来るので変換が必要
        @SupabaseUser() user: SupabaseUserType, // requestingUser の方が意図が明確かも
        @Body() body?: RegenerateScriptDto,
    ): Promise<SuccessResponse<{ jobId?: string }>> {
        // 戻り値の型を明確化
        const summaryId = Number.parseInt(summaryIdParam, 10);
        if (Number.isNaN(summaryId)) {
            throw new HttpException(
                "Invalid summary ID format",
                HttpStatus.BAD_REQUEST,
            );
        }

        this.logger.log(
            `User ${user.id} requesting script regeneration for summary ID ${summaryId}`,
        );

        // 所有者チェック：このsummaryIdがリクエスト発行ユーザー (user.id) に属しているかどうかのチェック
        const summary = await this.dailySummaryRepository.findById(
            summaryId,
            user.id,
        );

        if (!summary) {
            this.logger.warn(
                `Summary not found or access denied: User ${user.id} attempted to access summary ${summaryId}`,
            );
            throw new HttpException(
                "Summary not found or access denied.",
                HttpStatus.NOT_FOUND,
            );
        }

        this.logger.log(
            `Ownership verified: User ${user.id} owns summary ${summaryId}`,
        );

        try {
            const result =
                await this.summaryScriptService.requestScriptGeneration(
                    user.id,
                    summaryId,
                    body?.prompt,
                );
            const message = `Script regeneration job (ID: ${result.jobId}) has been queued for summary ID ${summaryId}.`;
            this.logger.log(message);
            return buildResponse("Script regeneration queued", {
                jobId: result.jobId,
            });
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred";
            this.logger.error(
                `Failed to queue script regeneration for summary ID ${summaryId}: ${errorMessage}`,
                error instanceof Error ? error.stack : undefined,
            );
            throw new HttpException(
                "Failed to queue script regeneration.",
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
