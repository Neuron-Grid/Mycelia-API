import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { getErrorMessage } from "@/common/utils/error-message";
import { validateDto } from "@/common/utils/validation";
import { VectorUpdateJobDto } from "@/embedding/queue/dto/vector-update-job.dto";
import { EmbeddingQueueService } from "@/embedding/queue/embedding-queue.service";
import { EmbeddingBatchDataService } from "@/embedding/services/embedding-batch-data.service";
import { EmbeddingBatchUpdateService } from "@/embedding/services/embedding-batch-update.service";
import type {
    BatchProcessResult,
    EmbeddingUpdateItem,
    TableType,
} from "@/embedding/types/embedding-batch.types";
import { EmbeddingService } from "@/search/infrastructure/services/embedding.service";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { Database } from "@/types/schema";

type FnListActiveUsersRow =
    Database["public"]["Functions"]["fn_list_active_users"]["Returns"][number];

@Processor("embeddingQueue", { concurrency: 2 })
export class EmbeddingQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(EmbeddingQueueProcessor.name);
    private static readonly DEFAULT_BATCH_SIZE = 50;
    private static readonly OPENAI_BATCH_SIZE = 20;
    private static readonly RATE_LIMIT_DELAY_MS = 1000;
    private static readonly NEXT_BATCH_DELAY_MS = 2000;

    constructor(
        @InjectQueue("embeddingQueue") private readonly embeddingQueue: Queue,
        private readonly embeddingQueueService: EmbeddingQueueService,
        private readonly batchDataService: EmbeddingBatchDataService,
        private readonly batchUpdateService: EmbeddingBatchUpdateService,
        private readonly embeddingService: EmbeddingService,
        private readonly admin: SupabaseAdminService,
    ) {
        super();
    }

    async process(job: Job<VectorUpdateJobDto>): Promise<BatchProcessResult> {
        // グローバル更新（全ユーザー分の埋め込み更新を後続ジョブとして投入）
        if (job.name === "global-update") {
            await this.handleGlobalUpdate(job);
            return { processedCount: 0, hasMore: false };
        }
        // DTO バリデーション – 破損データを早期検出
        await validateDto(VectorUpdateJobDto, job.data);
        if (job.name === "single-update") {
            return this.handleSingleUpdate(job);
        }
        return this.handleBatchUpdate(job);
    }

    private async handleSingleUpdate(
        job: Job<VectorUpdateJobDto>,
    ): Promise<BatchProcessResult> {
        const { userId, tableType, recordId } = job.data;
        if (!recordId) {
            this.logger.warn(
                `Single update skipped: recordId is missing (user=${userId}, table=${tableType})`,
            );
            return { processedCount: 0, hasMore: false };
        }

        try {
            const item = await this.batchDataService.getSingleItem(
                userId,
                tableType,
                recordId,
            );
            if (!item) {
                this.logger.warn(
                    `Single update skipped: record not found (id=${recordId}, user=${userId}, table=${tableType})`,
                );
                return { processedCount: 0, hasMore: false };
            }

            const cleaned = this.embeddingService.preprocessText(
                item.contentText,
            );
            const normalized = cleaned?.trim();
            if (!normalized) {
                this.logger.warn(
                    `Single update skipped: empty content (id=${recordId}, user=${userId}, table=${tableType})`,
                );
                return { processedCount: 0, hasMore: false };
            }

            const embedding =
                await this.embeddingService.generateEmbedding(normalized);
            await this.batchUpdateService.updateEmbeddings(userId, tableType, [
                { id: recordId, embedding },
            ]);
            await job.updateProgress(100);
            return { processedCount: 1, hasMore: false };
        } catch (error: unknown) {
            await this.discardIfNonRetriable(job, error);
            this.logger.error(
                `Single update failed for user ${userId}: ${getErrorMessage(
                    error,
                )}`,
            );
            throw error;
        }
    }

    private async handleBatchUpdate(
        job: Job<VectorUpdateJobDto>,
    ): Promise<BatchProcessResult> {
        const {
            userId,
            tableType,
            batchSize = EmbeddingQueueProcessor.DEFAULT_BATCH_SIZE,
            lastProcessedId,
            totalEstimate,
        } = job.data;

        try {
            this.logger.log(
                `Processing embedding job for user ${userId}, table ${tableType}`,
            );

            this.embeddingQueueService.markBatchRunning(
                userId,
                tableType,
                totalEstimate,
            );

            const batchData = await this.batchDataService.getBatchData(
                userId,
                tableType,
                batchSize,
                lastProcessedId,
            );

            if (batchData.length === 0) {
                this.logger.log(
                    `No more data to process for user ${userId}, table ${tableType}`,
                );
                this.embeddingQueueService.markBatchCompleted(
                    userId,
                    tableType,
                );
                return { processedCount: 0, hasMore: false };
            }

            const embeddings = await this.generateEmbeddingsWithRateLimit(
                batchData.map((item) => item.contentText),
            );

            if (embeddings.length !== batchData.length) {
                throw new Error(
                    `Embedding count mismatch (expected ${batchData.length}, got ${embeddings.length})`,
                );
            }

            const updateItems: EmbeddingUpdateItem[] = batchData.map(
                (item, index) => ({
                    id: item.id,
                    embedding: embeddings[index],
                }),
            );

            await this.batchUpdateService.updateEmbeddings(
                userId,
                tableType,
                updateItems,
            );

            const lastId = batchData[batchData.length - 1].id;
            const hasMore = batchData.length === batchSize;

            if (hasMore) {
                await this.scheduleNextBatch(
                    userId,
                    tableType,
                    batchSize,
                    lastId,
                    job,
                );
                this.embeddingQueueService.markBatchWaiting(userId, tableType);
            }

            const progressSnapshot =
                this.embeddingQueueService.incrementBatchProgress(
                    userId,
                    tableType,
                    batchData.length,
                    totalEstimate ?? batchData.length,
                    hasMore,
                );

            await job.updateProgress(progressSnapshot.progress);

            this.logger.log(
                `Processed ${batchData.length} items for user ${userId}, table ${tableType}`,
            );

            return {
                processedCount: batchData.length,
                hasMore,
                lastProcessedId: lastId,
            };
        } catch (error: unknown) {
            await this.discardIfNonRetriable(job, error);
            this.embeddingQueueService.markBatchFailed(userId, tableType);
            this.logger.error(
                `Batch processing failed for user ${userId}: ${getErrorMessage(
                    error,
                )}`,
            );
            throw error;
        }
    }

    private async generateEmbeddingsWithRateLimit(
        texts: string[],
    ): Promise<number[][]> {
        const results: number[][] = [];
        if (texts.length === 0) {
            return results;
        }

        for (
            let i = 0;
            i < texts.length;
            i += EmbeddingQueueProcessor.OPENAI_BATCH_SIZE
        ) {
            const batch = texts.slice(
                i,
                i + EmbeddingQueueProcessor.OPENAI_BATCH_SIZE,
            );

            const embeddings =
                await this.embeddingService.generateEmbeddings(batch);
            results.push(...embeddings);

            if (i + EmbeddingQueueProcessor.OPENAI_BATCH_SIZE < texts.length) {
                await this.delay(EmbeddingQueueProcessor.RATE_LIMIT_DELAY_MS);
            }

            this.logger.debug(
                `Generated embeddings for ${
                    i + batch.length
                }/${texts.length} items`,
            );
        }

        return results;
    }

    private async scheduleNextBatch(
        userId: string,
        tableType: TableType,
        batchSize: number,
        lastId: number,
        currentJob: Job<VectorUpdateJobDto>,
    ): Promise<void> {
        await this.embeddingQueue.add(
            "batch-process",
            {
                userId,
                tableType,
                batchSize,
                lastProcessedId: lastId,
                totalEstimate: currentJob.data.totalEstimate,
            } as VectorUpdateJobDto,
            {
                delay: EmbeddingQueueProcessor.NEXT_BATCH_DELAY_MS,
                priority: 5,
            },
        );
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async discardIfNonRetriable(
        job: Job<VectorUpdateJobDto>,
        error: unknown,
    ): Promise<void> {
        const status = this.getErrorStatus(error);
        if (!this.isNonRetriableStatus(status)) {
            return;
        }
        try {
            await job.discard();
        } catch {
            /* noop */
        }
    }

    private getErrorStatus(error: unknown): number | undefined {
        if (!error || typeof error !== "object") {
            return undefined;
        }
        if (!("status" in error)) {
            return undefined;
        }
        const status = (error as { status?: unknown }).status;
        return typeof status === "number" ? status : undefined;
    }

    private isNonRetriableStatus(status?: number): boolean {
        return (
            status !== undefined &&
            status >= 400 &&
            status < 500 &&
            status !== 429
        );
    }

    private async handleGlobalUpdate(
        job: Job<VectorUpdateJobDto>,
    ): Promise<void> {
        this.logger.log("Starting global embedding update scheduling...");
        try {
            const sb = this.admin.getClient();
            // A+ Architecture: 直接テーブル操作を禁止し、RPC経由でアクセス
            const { data, error } = await sb.rpc("fn_list_active_users");
            if (error) throw error as Error;
            const users = (data ?? []) as FnListActiveUsersRow[];
            let enqueued = 0;
            for (const u of users) {
                try {
                    await this.embeddingQueueService.addUserEmbeddingBatchJob(
                        u.user_id,
                    );
                    enqueued++;
                } catch (error: unknown) {
                    this.logger.warn(
                        `Failed to enqueue embedding batch for user ${u.user_id}: ${getErrorMessage(
                            error,
                        )}`,
                    );
                }
            }
            await job.updateProgress(100);
            this.logger.log(
                `Enqueued embedding batch jobs for ${enqueued} user(s)`,
            );
        } catch (error: unknown) {
            this.logger.error(
                `Global embedding update scheduling failed: ${getErrorMessage(
                    error,
                )}`,
            );
            throw error;
        }
    }
}
