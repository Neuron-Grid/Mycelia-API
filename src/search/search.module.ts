import { Module } from '@nestjs/common';
import { SupabaseRequestModule } from '../supabase-request.module';
import { SearchController } from './application/controllers/search.controller';
import { SearchService } from './application/services/search.service';
import { EMBEDDING_SERVICE } from './domain/interfaces/embedding-service.interface';
import { SEARCH_REPOSITORY } from './domain/interfaces/search-repository.interface';
import { OpenAIEmbeddingClient } from './infrastructure/clients/openai-embedding.client';
import { SupabaseSearchClient } from './infrastructure/clients/supabase-search.client';
import { SearchRepositoryImpl } from './infrastructure/repositories/search.repository';
import { EmbeddingService } from './infrastructure/services/embedding.service';

@Module({
    imports: [SupabaseRequestModule],
    controllers: [SearchController],
    providers: [
        // Application Services
        SearchService,

        // Infrastructure Services
        EmbeddingService,
        OpenAIEmbeddingClient,
        SupabaseSearchClient,

        // Repository Implementation
        {
            provide: SEARCH_REPOSITORY,
            useClass: SearchRepositoryImpl,
        },

        // Service Implementation
        {
            provide: EMBEDDING_SERVICE,
            useClass: EmbeddingService,
        },
    ],
    exports: [SearchService, EmbeddingService, SEARCH_REPOSITORY, EMBEDDING_SERVICE],
})
export class SearchModule {}
