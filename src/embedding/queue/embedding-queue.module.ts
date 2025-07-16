import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SearchModule } from '../../search/search.module';
import { SupabaseRequestModule } from '../../supabase-request.module';
import { EMBEDDING_BATCH_CONFIG } from '../config/embedding-batch.config';
import { EmbeddingBatchDataService } from '../services/embedding-batch-data.service';
import { EmbeddingBatchUpdateService } from '../services/embedding-batch-update.service';
import { EmbeddingQueueProcessor } from './embedding-queue.processor';
import { EmbeddingQueueService } from './embedding-queue.service';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'embeddingQueue',
            defaultJobOptions: {
                removeOnComplete: EMBEDDING_BATCH_CONFIG.queue.removeOnComplete,
                removeOnFail: EMBEDDING_BATCH_CONFIG.queue.removeOnFail,
                attempts: EMBEDDING_BATCH_CONFIG.queue.attempts,
                backoff: { type: 'exponential', delay: EMBEDDING_BATCH_CONFIG.queue.backoffDelay },
            },
        }),
        SearchModule,
        SupabaseRequestModule,
    ],
    providers: [
        EmbeddingQueueService,
        EmbeddingQueueProcessor,
        EmbeddingBatchDataService,
        EmbeddingBatchUpdateService,
    ],
    exports: [EmbeddingQueueService],
})
export class EmbeddingQueueModule {}
