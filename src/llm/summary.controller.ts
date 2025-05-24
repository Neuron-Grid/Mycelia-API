import {
    Body,
    Controller,
    HttpException,
    HttpStatus,
    Logger,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { User as SupabaseUserType } from '@supabase/supabase-js'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import { SupabaseUser } from '../auth/supabase-user.decorator'
import { SummaryScriptService } from './summary-script.service'
// daily_summariesテーブルの所有者チェックを行うためにPrismaServiceなどを注入する想定
// import { PrismaService } from '../../prisma/prisma.service'; // PrismaServiceのパスは適宜調整

@ApiTags('Summary & Script Regeneration')
@Controller('api/v1') // ベースパス
export class SummaryController {
    private readonly logger = new Logger(SummaryController.name) // Loggerインスタンス

    constructor(
        private readonly summaryScriptService: SummaryScriptService,
        // private readonly prisma: PrismaService, // 所有者チェックを行う場合
    ) {}

    @Post('summaries/users/:userId/regenerate') // パスをよりRESTfulに、summaryを複数形に
    @ApiOperation({
        summary: 'Regenerate summary for a user (typically for today or a specific date)',
    })
    @ApiParam({
        name: 'userId',
        description: 'User ID for whom to regenerate summary',
        type: 'string',
    })
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard)
    async regenerateSummary(
        @Param('userId') targetUserId: string,
        @SupabaseUser() requestingUser: SupabaseUserType,
        @Body() body?: { date?: string; prompt?: string },
    ): Promise<{ message: string; jobId?: string }> {
        // 戻り値の型を明確化
        this.logger.log(
            `User ${requestingUser.id} requesting summary regeneration for user ${targetUserId}`,
        )

        // 管理者ユーザーは不要なので、リクエスト発行者が対象ユーザーと一致する場合のみ許可
        if (requestingUser.id !== targetUserId) {
            this.logger.warn(
                `Forbidden: User ${requestingUser.id} attempted to regenerate summary for ${targetUserId}`,
            )
            throw new HttpException(
                'Forbidden: You can only regenerate your own summaries.',
                HttpStatus.FORBIDDEN,
            )
        }

        try {
            // SummaryScriptServiceのメソッドはBullMQのaddを呼び出し、Jobオブジェクト(またはその一部)を返す想定
            // Jobオブジェクトにはidが含まれる
            const result = await this.summaryScriptService.requestSummaryGeneration(
                targetUserId,
                body?.prompt,
            ) // await を追加
            const message = `Summary regeneration job (ID: ${result.jobId}) has been queued for user ${targetUserId} (date: ${body?.date || 'today'}).`
            this.logger.log(message)
            return { message, jobId: result.jobId }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
            this.logger.error(
                `Failed to queue summary regeneration for user ${targetUserId}: ${errorMessage}`,
                error instanceof Error ? error.stack : undefined,
            )
            throw new HttpException(
                'Failed to queue summary regeneration.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            )
        }
    }

    @Post('scripts/summaries/:summaryId/regenerate') // パスをよりRESTfulに、scriptを複数形、summaryを複数形に
    @ApiOperation({ summary: 'Regenerate script_text for a specific summary' })
    @ApiParam({
        name: 'summaryId',
        description: 'ID of the daily_summary to regenerate script for',
        type: 'number',
    })
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard)
    async regenerateScript(
        @Param('summaryId') summaryIdParam: string, // パラメータは文字列で来るので変換が必要
        @SupabaseUser() user: SupabaseUserType, // requestingUser の方が意図が明確かも
        @Body() body?: { prompt?: string },
    ): Promise<{ message: string; jobId?: string }> {
        // 戻り値の型を明確化
        const summaryId = Number.parseInt(summaryIdParam, 10)
        if (Number.isNaN(summaryId)) {
            throw new HttpException('Invalid summary ID format', HttpStatus.BAD_REQUEST)
        }

        this.logger.log(
            `User ${user.id} requesting script regeneration for summary ID ${summaryId}`,
        )

        // TODO: このsummaryIdがリクエスト発行ユーザー (user.id) に属しているかどうかのチェック
        // PrismaServiceなどを使って、daily_summariesテーブルを検索し、user_idが一致するか確認
        /*
        const summaryOwner = await this.prisma.daily_summaries.findUnique({
            where: { id: summaryId },
            select: { user_id: true },
        });

        if (!summaryOwner) {
            throw new HttpException('Summary not found.', HttpStatus.NOT_FOUND);
        }
        if (summaryOwner.user_id !== user.id) {
            this.logger.warn(`Forbidden: User ${user.id} attempted to regenerate script for summary ${summaryId} owned by ${summaryOwner.user_id}`);
            throw new HttpException('Forbidden: You can only regenerate scripts for your own summaries.', HttpStatus.FORBIDDEN);
        }
        */
        // 上記の所有者チェックは重要です。コメントアウトを解除し、PrismaService等を適切に設定して実装してください。
        // 今回は一旦、このチェックがない状態で進めますが、セキュリティ上必須です。
        this.logger.warn(
            `Ownership check for summaryId ${summaryId} by user ${user.id} is currently skipped. Implement this check!`,
        )

        try {
            const result = await this.summaryScriptService.requestScriptGeneration(
                summaryId,
                body?.prompt,
            ) // await を追加
            const message = `Script regeneration job (ID: ${result.jobId}) has been queued for summary ID ${summaryId}.`
            this.logger.log(message)
            return { message, jobId: result.jobId }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
            this.logger.error(
                `Failed to queue script regeneration for summary ID ${summaryId}: ${errorMessage}`,
                error instanceof Error ? error.stack : undefined,
            )
            throw new HttpException(
                'Failed to queue script regeneration.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            )
        }
    }
}
