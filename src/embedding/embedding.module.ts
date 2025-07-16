import { Module } from '@nestjs/common';
import { EmbeddingController } from './embedding.controller';
import { EmbeddingQueueModule } from './queue/embedding-queue.module';

@Module({
    imports: [EmbeddingQueueModule],
    controllers: [EmbeddingController],
    exports: [EmbeddingQueueModule],
})
export class EmbeddingModule {}
