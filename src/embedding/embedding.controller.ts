import { TypedBody, TypedRoute } from "@nestia/core";
import { Controller, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import { SupabaseUser } from "../auth/supabase-user.decorator";
import type { BatchProgressItemDto } from "./dto/batch-progress-response.dto";
import { BatchUpdateRequestDto } from "./dto/batch-update-request.dto";
import { EmbeddingQueueService } from "./queue/embedding-queue.service";

@Controller("embeddings")
@UseGuards(SupabaseAuthGuard)
export class EmbeddingController {
    constructor(
        private readonly embeddingQueueService: EmbeddingQueueService,
    ) {}

    /** Trigger batch embedding update */
    @TypedRoute.Post("batch-update")
    @HttpCode(HttpStatus.ACCEPTED)
    async triggerBatchUpdate(
        @SupabaseUser() user: User,
        @TypedBody() request: BatchUpdateRequestDto,
    ): Promise<SuccessResponse<{ userId: string }>> {
        await this.embeddingQueueService.addUserEmbeddingBatchJob(
            user.id,
            request.tableTypes,
        );
        return buildResponse("Batch update initiated", { userId: user.id });
    }

    /** Get current progress of batch embedding updates */
    @TypedRoute.Get("progress")
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
