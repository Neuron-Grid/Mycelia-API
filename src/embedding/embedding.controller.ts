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
import { buildResponse } from "@/common/utils/response.util";
import { SupabaseUser } from "../auth/supabase-user.decorator";
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
    ) {
        await this.embeddingQueueService.addUserEmbeddingBatchJob(
            user.id,
            request.tableTypes,
        );
        return buildResponse("Batch update initiated", { userId: user.id });
    }

    @Get("progress")
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
    async getBatchProgress(@SupabaseUser() user: User) {
        const progress = await this.embeddingQueueService.getBatchProgress(
            user.id,
        );
        return buildResponse("Progress retrieved successfully", progress);
    }
}
