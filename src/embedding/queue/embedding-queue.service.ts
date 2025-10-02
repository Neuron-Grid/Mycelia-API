import { InjectQueue } from "@nestjs/bullmq";
import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { EmbeddingBatchDataService } from "../services/embedding-batch-data.service";
import { BatchProgress, TableType } from "../types/embedding-batch.types";
import { VectorUpdateJobDto } from "./dto/vector-update-job.dto";

@Injectable()
export class EmbeddingQueueService {
    private readonly logger = new Logger(EmbeddingQueueService.name);

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

        const counts = await this.embeddingQueue.getJobCounts();
        const waiting = counts.waiting ?? 0;
        const active = counts.active ?? 0;
        if (waiting + active > 3) {
            throw new HttpException(
                "Embedding queue is currently busy. Please retry later.",
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        this.logger.log(`Starting batch embedding update for user ${userId}`);

        for (const tableType of uniqueTables) {
            try {
                const jobId = `batch:${userId}:${tableType}`;
                const existingJob = await this.embeddingQueue.getJob(jobId);
                if (existingJob) {
                    this.logger.log(
                        `Skip batch job for ${tableType}: existing job ${jobId}`,
                    );
                    continue;
                }
                const missingCount =
                    await this.batchDataService.getMissingEmbeddingsCount(
                        userId,
                        tableType,
                    );

                if (missingCount > 0) {
                    await this.embeddingQueue.add(
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
                        `Added batch job for ${tableType}: ${missingCount} items to process`,
                    );
                } else {
                    this.logger.log(`No missing embeddings for ${tableType}`);
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

    async getBatchProgress(userId: string): Promise<BatchProgress[]> {
        try {
            const jobs = await this.embeddingQueue.getJobs([
                "active",
                "waiting",
                "completed",
            ]);

            return jobs
                .filter((job) => job.data.userId === userId)
                .map((job) => {
                    const progress =
                        typeof job.progress === "number" ? job.progress : 0;
                    const total =
                        typeof job.data.totalEstimate === "number"
                            ? job.data.totalEstimate
                            : 0;
                    return {
                        userId: job.data.userId,
                        tableType: job.data.tableType,
                        status: job.finishedOn
                            ? "completed"
                            : job.processedOn
                              ? "running"
                              : "waiting",
                        progress,
                        totalRecords: total,
                        processedRecords: Math.floor((progress / 100) * total),
                    } as BatchProgress;
                });
        } catch (error) {
            this.logger.error(`Failed to get batch progress: ${error.message}`);
            throw error;
        }
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
}
