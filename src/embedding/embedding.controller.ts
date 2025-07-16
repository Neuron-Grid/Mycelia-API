import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    UseGuards,
} from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SupabaseUser } from "../auth/supabase-user.decorator";
import { BatchProgressResponseDto } from "./dto/batch-progress-response.dto";
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

    @Post("batch-update")
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({
        summary: "Trigger batch embedding update",
        description:
            "Start batch update of embeddings for specified table types",
    })
    @ApiResponse({
        status: HttpStatus.ACCEPTED,
        description: "Batch update initiated successfully",
        schema: {
            type: "object",
            properties: {
                message: { type: "string", example: "Batch update initiated" },
                userId: { type: "string", example: "user-uuid-123" },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: "Bad Request - Invalid table types",
    })
    @ApiResponse({ status: 401, description: "Unauthorized" })
    async triggerBatchUpdate(
        @SupabaseUser() user: User,
        @Body() request: BatchUpdateRequestDto,
    ): Promise<{ message: string; userId: string }> {
        await this.embeddingQueueService.addUserEmbeddingBatchJob(
            user.id,
            request.tableTypes,
        );
        return { message: "Batch update initiated", userId: user.id };
    }

    @Get("progress")
    @ApiOperation({
        summary: "Get batch progress",
        description: "Get current progress of batch embedding updates",
    })
    @ApiResponse({
        status: 200,
        description: "Progress information returned successfully",
        type: BatchProgressResponseDto,
    })
    @ApiResponse({ status: 401, description: "Unauthorized" })
    async getBatchProgress(
        @SupabaseUser() user: User,
    ): Promise<BatchProgressResponseDto> {
        const progress = await this.embeddingQueueService.getBatchProgress(
            user.id,
        );
        return { message: "Progress retrieved successfully", data: progress };
    }
}
