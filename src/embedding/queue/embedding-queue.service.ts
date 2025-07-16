import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EmbeddingBatchDataService } from '../services/embedding-batch-data.service';
import { BatchProgress, TableType } from '../types/embedding-batch.types';
import { VectorUpdateJobDto } from './dto/vector-update-job.dto';

@Injectable()
export class EmbeddingQueueService {
    private readonly logger = new Logger(EmbeddingQueueService.name);

    constructor(
        @InjectQueue('embeddingQueue') private readonly embeddingQueue: Queue,
        private readonly batchDataService: EmbeddingBatchDataService,
    ) {}

    async addUserEmbeddingBatchJob(userId: string, tableTypes?: TableType[]): Promise<void> {
        const tables = tableTypes || ['feed_items', 'daily_summaries', 'podcast_episodes', 'tags'];

        this.logger.log(`Starting batch embedding update for user ${userId}`);

        for (const tableType of tables) {
            try {
                const missingCount = await this.batchDataService.getMissingEmbeddingsCount(
                    userId,
                    tableType,
                );

                if (missingCount > 0) {
                    await this.embeddingQueue.add(
                        'batch-process',
                        {
                            userId,
                            tableType,
                            batchSize: 50,
                            totalEstimate: missingCount,
                        } as VectorUpdateJobDto,
                        {
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
                this.logger.error(`Failed to add batch job for ${tableType}: ${error.message}`);
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
                'single-update',
                {
                    userId,
                    tableType,
                    recordId,
                } as VectorUpdateJobData,
                {
                    priority: 10,
                },
            );

            this.logger.log(`Added single embedding job for ${tableType} record ${recordId}`);
        } catch (error) {
            this.logger.error(`Failed to add single embedding job: ${error.message}`);
            throw error;
        }
    }

    async getBatchProgress(userId: string): Promise<BatchProgress[]> {
        try {
            const jobs = await this.embeddingQueue.getJobs(['active', 'waiting', 'completed']);

            return jobs
                .filter((job) => job.data.userId === userId)
                .map((job) => ({
                    userId: job.data.userId,
                    tableType: job.data.tableType,
                    status: job.finishedOn ? 'completed' : job.processedOn ? 'running' : 'waiting',
                    progress: job.progress || 0,
                    totalRecords: job.data.totalEstimate,
                    processedRecords: Math.floor(
                        ((job.progress || 0) / 100) * (job.data.totalEstimate || 0),
                    ),
                }));
        } catch (error) {
            this.logger.error(`Failed to get batch progress: ${error.message}`);
            throw error;
        }
    }

    async addGlobalEmbeddingUpdateJob(): Promise<void> {
        try {
            await this.embeddingQueue.add('global-update', {} as VectorUpdateJobDto, {
                priority: 1,
            });

            this.logger.log('Added global embedding update job');
        } catch (error) {
            this.logger.error(`Failed to add global embedding update job: ${error.message}`);
            throw error;
        }
    }
}
