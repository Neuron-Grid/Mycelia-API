import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { validateDto } from 'src/common/utils/validation';
import { EmbeddingService } from '../../search/embedding.service';
import { EmbeddingBatchDataService } from '../services/embedding-batch-data.service';
import { EmbeddingBatchUpdateService } from '../services/embedding-batch-update.service';
import { BatchProcessResult, EmbeddingUpdateItem, TableType } from '../types/embedding-batch.types';
import { VectorUpdateJobDto } from './dto/vector-update-job.dto';

@Processor('embeddingQueue')
export class EmbeddingQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(EmbeddingQueueProcessor.name);

    constructor(
        @InjectQueue('embeddingQueue') private readonly embeddingQueue: Queue,
        private readonly batchDataService: EmbeddingBatchDataService,
        private readonly batchUpdateService: EmbeddingBatchUpdateService,
        private readonly embeddingService: EmbeddingService,
    ) {
        super();
    }

    async process(job: Job<VectorUpdateJobDto>): Promise<BatchProcessResult> {
        // DTO バリデーション – 破損データを早期検出
        await validateDto(VectorUpdateJobDto, job.data);
        const { userId, tableType, batchSize = 50, lastProcessedId } = job.data;

        try {
            this.logger.log(`Processing embedding job for user ${userId}, table ${tableType}`);

            const batchData = await this.batchDataService.getBatchData(
                userId,
                tableType,
                batchSize,
                lastProcessedId,
            );

            if (batchData.length === 0) {
                this.logger.log(`No more data to process for user ${userId}, table ${tableType}`);
                return { processedCount: 0, hasMore: false };
            }

            const embeddings = await this.generateEmbeddingsWithRateLimit(
                batchData.map((item) => item.contentText),
            );

            const updateItems: EmbeddingUpdateItem[] = batchData.map((item, index) => ({
                id: item.id,
                embedding: embeddings[index],
            }));

            await this.batchUpdateService.updateEmbeddings(userId, tableType, updateItems);

            const lastId = batchData[batchData.length - 1].id;
            const hasMore = batchData.length === batchSize;

            if (hasMore) {
                await this.scheduleNextBatch(userId, tableType, batchSize, lastId, job);
            }

            const progress = hasMore ? 50 : 100;
            await job.updateProgress(progress);

            this.logger.log(
                `Processed ${batchData.length} items for user ${userId}, table ${tableType}`,
            );

            return {
                processedCount: batchData.length,
                hasMore,
                lastProcessedId: lastId,
            };
        } catch (error) {
            this.logger.error(`Batch processing failed for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    private async generateEmbeddingsWithRateLimit(texts: string[]): Promise<number[][]> {
        const OPENAI_BATCH_SIZE = 20;
        const RATE_LIMIT_DELAY = 1000;

        const results: number[][] = [];

        for (let i = 0; i < texts.length; i += OPENAI_BATCH_SIZE) {
            const batch = texts.slice(i, i + OPENAI_BATCH_SIZE);

            const embeddings = await this.embeddingService.generateEmbeddings(batch);
            results.push(...embeddings);

            if (i + OPENAI_BATCH_SIZE < texts.length) {
                await this.delay(RATE_LIMIT_DELAY);
            }

            this.logger.debug(`Generated embeddings for ${i + batch.length}/${texts.length} items`);
        }

        return results;
    }

    private async scheduleNextBatch(
        userId: string,
        tableType: TableType,
        batchSize: number,
        lastId: number,
        _currentJob: Job<VectorUpdateJobDto>,
    ): Promise<void> {
        await this.embeddingQueue.add(
            'batch-process',
            {
                userId,
                tableType,
                batchSize,
                lastProcessedId: lastId,
            } as VectorUpdateJobDto,
            {
                delay: 2000,
                priority: 5,
            },
        );
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
