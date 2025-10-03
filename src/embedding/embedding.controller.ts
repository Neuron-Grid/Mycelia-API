import { TypedBody, TypedRoute } from "@nestia/core";
import { Controller, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import { BatchUpdateEnqueuedDto } from "@/embedding/dto/batch-update-enqueued.dto";
import { SupabaseUser } from "../auth/supabase-user.decorator";
import type { BatchProgressItemDto } from "./dto/batch-progress-response.dto";
import { BatchUpdateRequestDto } from "./dto/batch-update-request.dto";
import { EmbeddingQueueService } from "./queue/embedding-queue.service";

@Controller("embeddings")
@UseGuards(SupabaseAuthGuard, ThrottlerGuard)
export class EmbeddingController {
    constructor(
        private readonly embeddingQueueService: EmbeddingQueueService,
    ) {}

    /** Trigger batch embedding update */
    @TypedRoute.Post("batch-update")
    @HttpCode(HttpStatus.ACCEPTED)
    // ttl はミリ秒単位のため 1000 = 1 秒
    @Throttle({ default: { limit: 1, ttl: 1000 } })
    async triggerBatchUpdate(
        @SupabaseUser() user: User,
        @TypedBody() request: BatchUpdateRequestDto,
    ): Promise<SuccessResponse<BatchUpdateEnqueuedDto>> {
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
