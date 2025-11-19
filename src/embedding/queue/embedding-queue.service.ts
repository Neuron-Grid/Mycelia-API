import { InjectQueue } from "@nestjs/bullmq";
import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { EmbeddingBatchDataService } from "../services/embedding-batch-data.service";
import {
    BatchProgress,
    ProgressCacheEntry,
    TableType,
} from "../types/embedding-batch.types";
import { VectorUpdateJobDto } from "./dto/vector-update-job.dto";

@Injectable()
export class EmbeddingQueueService {
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Used to check job states but analyzer cannot follow Set.has usage.
    private static readonly IN_PROGRESS_STATES = new Set([
        "waiting",
        "waiting-children",
        "delayed",
        "active",
        "paused",
    ]);

    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Referenced when gating concurrent jobs per user.
    private static readonly MAX_BATCH_JOBS_PER_USER = 4;
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Used for progress cache expiry calculations even if analyzer loses track.
    private static readonly PROGRESS_TTL_MS = 15 * 60 * 1000;

    private readonly logger = new Logger(EmbeddingQueueService.name);
    private readonly progressCache = new Map<
        string,
        Map<TableType, ProgressCacheEntry>
    >();

    constructor(
        @InjectQueue("embeddingQueue")
        private readonly embeddingQueue: Queue<VectorUpdateJobDto>,
        private readonly batchDataService: EmbeddingBatchDataService,
    ) {}

    async addUserEmbeddingBatchJob(
        userId: string,
        tableTypes?: TableType[],
    ): Promise<void> {
        const tables = tableTypes || [
            "feed_items",
            "daily_summaries",
            "podcast_episodes",
            "tags",
        ];
        const uniqueTables = [...new Set(tables)];

        const concurrencyLimit = Math.min(
            uniqueTables.length,
            EmbeddingQueueService.MAX_BATCH_JOBS_PER_USER,
        );

        const inspectionResults = await Promise.all(
            uniqueTables.map(async (tableType) => {
                const jobId = this.buildBatchJobId(userId, tableType);
                const job = await this.embeddingQueue.getJob(jobId);
                const state = job ? await job.getState() : null;
                return { tableType, jobId, job, state } as const;
            }),
        );

        let activeUserBatchJobs = inspectionResults.filter(({ state }) =>
            this.isJobInProgress(state),
        ).length;

        if (activeUserBatchJobs >= concurrencyLimit) {
            throw new HttpException(
                `Embedding batch jobs already running for user ${userId} (limit ${concurrencyLimit}). Please retry later`,
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        this.logger.log(
            `Starting batch embedding update for user ${userId} (slots available: ${concurrencyLimit - activeUserBatchJobs})`,
        );

        for (const { tableType, job, jobId, state } of inspectionResults) {
            try {
                if (this.isJobInProgress(state)) {
                    this.logger.debug(
                        `Skip batch job for ${tableType}: existing job ${jobId} still ${state}`,
                    );
                    continue;
                }

                if (job) {
                    this.logger.log(
                        `Removing stale job for ${tableType}: existing job ${jobId} is ${state}`,
                    );
                    await job.remove();
                }

                if (activeUserBatchJobs >= concurrencyLimit) {
                    throw new HttpException(
                        `Embedding batch limit reached for user ${userId}. Capacity ${concurrencyLimit}, running ${activeUserBatchJobs}`,
                        HttpStatus.TOO_MANY_REQUESTS,
                    );
                }

                const missingCount =
                    await this.batchDataService.getMissingEmbeddingsCount(
                        userId,
                        tableType,
                    );

                if (missingCount > 0) {
                    const newJob = await this.embeddingQueue.add(
                        "batch-process",
                        {
                            userId,
                            tableType,
                            batchSize: 50,
                            totalEstimate: missingCount,
                        } as VectorUpdateJobDto,
                        {
                            jobId,
                            priority: 5,
                            removeOnComplete: 5,
                            removeOnFail: 10,
                        },
                    );

                    this.logger.log(
                        `Added batch job ${newJob.id} for ${tableType}: ${missingCount} items to process`,
                    );
                    this.initializeBatchProgress(
                        userId,
                        tableType,
                        missingCount,
                    );
                    activeUserBatchJobs++;
                } else {
                    this.logger.log(`No missing embeddings for ${tableType}`);
                    this.markBatchCompleted(userId, tableType);
                }
            } catch (error) {
                this.logger.error(
                    `Failed to add batch job for ${tableType}: ${error.message}`,
                );
                throw error;
            }
        }
    }

    async addSingleEmbeddingJob(
        userId: string,
        recordId: number,
        tableType: TableType,
    ): Promise<void> {
        try {
            await this.embeddingQueue.add(
                "single-update",
                {
                    userId,
                    tableType,
                    recordId,
                } as VectorUpdateJobDto,
                {
                    priority: 10,
                },
            );

            this.logger.log(
                `Added single embedding job for ${tableType} record ${recordId}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to add single embedding job: ${error.message}`,
            );
            throw error;
        }
    }

    getBatchProgress(userId: string): BatchProgress[] {
        this.purgeExpiredProgress(userId);
        const userProgress = this.progressCache.get(userId);
        if (!userProgress) {
            return [];
        }

        return Array.from(userProgress.values())
            .map((entry) => entry.progress)
            .sort((a, b) => a.tableType.localeCompare(b.tableType));
    }

    async addGlobalEmbeddingUpdateJob(): Promise<void> {
        try {
            await this.embeddingQueue.add(
                "global-update",
                {} as VectorUpdateJobDto,
                {
                    priority: 1,
                },
            );

            this.logger.log("Added global embedding update job");
        } catch (error) {
            this.logger.error(
                `Failed to add global embedding update job: ${error.message}`,
            );
            throw error;
        }
    }

    private buildBatchJobId(userId: string, tableType: TableType): string {
        return `batch:${userId}:${tableType}`;
    }

    private isJobInProgress(state: string | null): boolean {
        return (
            state != null && EmbeddingQueueService.IN_PROGRESS_STATES.has(state)
        );
    }

    public initializeBatchProgress(
        userId: string,
        tableType: TableType,
        totalRecords: number,
    ): void {
        const progress: BatchProgress = {
            userId,
            tableType,
            status: "waiting",
            progress: totalRecords > 0 ? 0 : 100,
            totalRecords,
            processedRecords: 0,
        };
        this.setProgress(userId, tableType, progress);
    }

    public markBatchRunning(
        userId: string,
        tableType: TableType,
        totalRecords?: number,
    ): void {
        const current = this.getProgress(userId, tableType);
        const updated: BatchProgress = {
            userId,
            tableType,
            status: "running",
            totalRecords: totalRecords ?? current?.totalRecords,
            processedRecords: current?.processedRecords ?? 0,
            progress: current?.progress ?? 0,
        };
        this.setProgress(userId, tableType, updated);
    }

    public markBatchWaiting(userId: string, tableType: TableType): void {
        const current = this.getProgress(userId, tableType);
        if (!current) return;
        this.setProgress(userId, tableType, {
            ...current,
            status: "waiting",
        });
    }

    public incrementBatchProgress(
        userId: string,
        tableType: TableType,
        processedDelta: number,
        totalRecords?: number,
        hasMore?: boolean,
    ): BatchProgress {
        const current = this.getProgress(userId, tableType);
        const total = totalRecords ?? current?.totalRecords ?? 0;
        const processed = Math.max(
            0,
            (current?.processedRecords ?? 0) + Math.max(processedDelta, 0),
        );
        const progress =
            total > 0
                ? Math.min(100, Math.round((processed / total) * 100))
                : 100;

        const inProgress = hasMore === true;

        const updated: BatchProgress = {
            userId,
            tableType,
            status: inProgress ? "running" : "completed",
            totalRecords: total,
            processedRecords: processed,
            progress: inProgress ? Math.min(progress, 99) : progress,
        };

        this.setProgress(userId, tableType, updated, {
            scheduleExpiry: inProgress,
        });

        if (!inProgress) {
            this.cleanupProgress(userId, tableType);
        }

        return updated;
    }

    public markBatchCompleted(userId: string, tableType: TableType): void {
        const current = this.getProgress(userId, tableType);
        const completed: BatchProgress = {
            userId,
            tableType,
            status: "completed",
            totalRecords:
                current?.totalRecords ?? current?.processedRecords ?? 0,
            processedRecords:
                current?.totalRecords ?? current?.processedRecords ?? 0,
            progress: 100,
        };

        this.setProgress(userId, tableType, completed, {
            scheduleExpiry: false,
        });
        this.cleanupProgress(userId, tableType);
    }

    public markBatchFailed(userId: string, tableType: TableType): void {
        const current = this.getProgress(userId, tableType);
        const failed: BatchProgress = {
            userId,
            tableType,
            status: "failed",
            totalRecords: current?.totalRecords ?? current?.processedRecords,
            processedRecords: current?.processedRecords,
            progress: current?.progress ?? 0,
        };

        this.setProgress(userId, tableType, failed, {
            scheduleExpiry: false,
        });
        this.cleanupProgress(userId, tableType);
    }

    public getProgressSnapshot(
        userId: string,
        tableType: TableType,
    ): BatchProgress | undefined {
        this.purgeExpiredProgress(userId);
        return this.getProgress(userId, tableType);
    }

    private getProgress(
        userId: string,
        tableType: TableType,
    ): BatchProgress | undefined {
        return this.progressCache.get(userId)?.get(tableType)?.progress;
    }

    private setProgress(
        userId: string,
        tableType: TableType,
        progress: BatchProgress,
        options?: { ttlMs?: number; scheduleExpiry?: boolean },
    ): void {
        let userProgress = this.progressCache.get(userId);
        if (!userProgress) {
            userProgress = new Map<TableType, ProgressCacheEntry>();
            this.progressCache.set(userId, userProgress);
        }

        const existing = userProgress.get(tableType);
        if (existing?.timeoutId) {
            clearTimeout(existing.timeoutId);
        }

        const ttlMs = options?.ttlMs ?? EmbeddingQueueService.PROGRESS_TTL_MS;
        const scheduleExpiry = options?.scheduleExpiry ?? true;

        const entry: ProgressCacheEntry = {
            progress,
            expiresAt: Date.now() + ttlMs,
        };

        if (scheduleExpiry) {
            entry.timeoutId = this.scheduleExpiry(userId, tableType, ttlMs);
        }

        userProgress.set(tableType, entry);
    }

    private scheduleExpiry(
        userId: string,
        tableType: TableType,
        ttlMs: number,
    ): NodeJS.Timeout {
        const timeoutId = setTimeout(() => {
            this.handleExpiry(userId, tableType);
        }, ttlMs);

        if (typeof timeoutId.unref === "function") {
            timeoutId.unref();
        }

        return timeoutId;
    }

    private handleExpiry(userId: string, tableType: TableType): void {
        const entry = this.progressCache.get(userId)?.get(tableType);
        if (!entry) {
            return;
        }

        if (entry.expiresAt <= Date.now()) {
            this.cleanupProgress(userId, tableType);
            return;
        }

        const remaining = entry.expiresAt - Date.now();
        entry.timeoutId = this.scheduleExpiry(userId, tableType, remaining);
    }

    private purgeExpiredProgress(userId: string): void {
        const userProgress = this.progressCache.get(userId);
        if (!userProgress) {
            return;
        }

        for (const [tableType, entry] of userProgress.entries()) {
            if (entry.expiresAt <= Date.now()) {
                this.cleanupProgress(userId, tableType);
            }
        }
    }

    private cleanupProgress(userId: string, tableType: TableType): void {
        const userProgress = this.progressCache.get(userId);
        if (!userProgress) {
            return;
        }

        const entry = userProgress.get(tableType);
        if (entry?.timeoutId) {
            clearTimeout(entry.timeoutId);
        }

        userProgress.delete(tableType);

        if (userProgress.size === 0) {
            this.progressCache.delete(userId);
        }
    }
}
