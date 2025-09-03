import { TypedBody, TypedParam, TypedRoute } from "@nestia/core";
import {
    Controller,
    HttpException,
    HttpStatus,
    Logger,
    UseGuards,
} from "@nestjs/common";
import { User as SupabaseUserType } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import { parseUInt32 } from "@/common/utils/typed-param";
import { RegenerateScriptDto } from "@/llm/application/dto/regenerate-script.dto";
import { RegenerateSummaryDto } from "@/llm/application/dto/regenerate-summary.dto";
import { SupabaseUser } from "../../../auth/supabase-user.decorator";
import { DailySummaryRepository } from "../../infrastructure/repositories/daily-summary.repository";
import { SummaryScriptService } from "../services/summary-script.service";

@Controller() // グローバルPrefix `api/v1` を利用（ベースパスは空）
export class SummaryController {
    private readonly logger = new Logger(SummaryController.name); // Loggerインスタンス

    constructor(
        private readonly summaryScriptService: SummaryScriptService,
        private readonly dailySummaryRepository: DailySummaryRepository,
    ) {}

    /** Regenerate summary for a user */
    @TypedRoute.Post("summaries/users/:userId/regenerate") // パスをよりRESTfulに、summaryを複数形に
    @UseGuards(SupabaseAuthGuard)
    async regenerateSummary(
        @TypedParam("userId", (v) => v) targetUserId: string,
        @SupabaseUser() requestingUser: SupabaseUserType,
        @TypedBody() body?: RegenerateSummaryDto,
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

    /** Regenerate script_text for a specific summary */
    @TypedRoute.Post("scripts/summaries/:summaryId/regenerate") // パスをよりRESTfulに、scriptを複数形、summaryを複数形に
    @UseGuards(SupabaseAuthGuard)
    async regenerateScript(
        @TypedParam("summaryId", parseUInt32) summaryId: number,
        @SupabaseUser() user: SupabaseUserType, // requestingUser の方が意図が明確かも
        @TypedBody() body?: RegenerateScriptDto,
    ): Promise<SuccessResponse<{ jobId?: string }>> {
        // 戻り値の型を明確化

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
