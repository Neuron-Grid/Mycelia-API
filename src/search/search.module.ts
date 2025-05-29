import { Module } from '@nestjs/common'
import { EmbeddingService } from './embedding.service'
import { VectorSearchService } from './vector-search.service'
import { SearchController } from './search.controller'

@Module({
    controllers: [SearchController],
    providers: [EmbeddingService, VectorSearchService],
    exports: [EmbeddingService, VectorSearchService],
})
export class SearchModule {}