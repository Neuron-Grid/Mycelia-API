import { Module } from '@nestjs/common'
import { EmbeddingService } from './embedding.service'
import { SearchController } from './search.controller'
import { VectorSearchService } from './vector-search.service'

@Module({
    controllers: [SearchController],
    providers: [EmbeddingService, VectorSearchService],
    exports: [EmbeddingService, VectorSearchService],
})
export class SearchModule {}
