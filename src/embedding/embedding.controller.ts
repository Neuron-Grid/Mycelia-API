import { TypedRoute } from "@nestia/core";
import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    UseGuards,
} from "@nestjs/common";
import {
    ApiAcceptedResponse,
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from "@nestjs/swagger";
import { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { ErrorResponseDto } from "@/common/dto/error-response.dto";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import { SupabaseUser } from "../auth/supabase-user.decorator";
import type { BatchProgressItemDto } from "./dto/batch-progress-response.dto";
import { BatchUpdateRequestDto } from "./dto/batch-update-request.dto";
import { EmbeddingQueueService } from "./queue/embedding-queue.service";

@ApiTags("Embeddings")
@Controller("embeddings")
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
export class EmbeddingController {
    constructor(
        private readonly embeddingQueueService: EmbeddingQueueService,
    ) {}

    @TypedRoute.Post("batch-update")
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({
        summary: "Trigger batch embedding update",
        description:
            "Start batch update of embeddings for specified table types",
    })
    @ApiAcceptedResponse({
        description: "Returns { message, data: { userId } }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "object",
                    properties: { userId: { type: "string" } },
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad Request - Invalid table types",
        type: ErrorResponseDto,
    })
    async triggerBatchUpdate(
        @SupabaseUser() user: User,
        @Body() request: BatchUpdateRequestDto,
    ): Promise<SuccessResponse<{ userId: string }>> {
        await this.embeddingQueueService.addUserEmbeddingBatchJob(
            user.id,
            request.tableTypes,
        );
        return buildResponse("Batch update initiated", { userId: user.id });
    }

    @TypedRoute.Get("progress")
    @ApiOperation({
        summary: "Get batch progress",
        description: "Get current progress of batch embedding updates",
    })
    @ApiOkResponse({
        description: "Returns { message, data: BatchProgressResponseDto[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "array",
                    items: {
                        $ref: "#/components/schemas/BatchProgressResponseDto",
                    },
                },
            },
        },
    })
    async getBatchProgress(
        @SupabaseUser() user: User,
    ): Promise<SuccessResponse<BatchProgressItemDto[]>> {
        const progress = await this.embeddingQueueService.getBatchProgress(
            user.id,
        );
        // ここではBatchProgress（サービスの戻り値）を外向けDTOに合わせる
        const mapped = progress.map((p) => ({
            userId: p.userId,
            tableType: p.tableType,
            status: p.status,
            progress: p.progress,
            totalRecords: p.totalRecords ?? 0,
            processedRecords: p.processedRecords,
        }));
        return buildResponse("Progress retrieved successfully", mapped);
    }
}
