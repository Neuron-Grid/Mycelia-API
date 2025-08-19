import { Module } from "@nestjs/common";
import { SearchController } from "@/search/application/controllers/search.controller";
import { SearchService } from "@/search/application/services/search.service";
import { EMBEDDING_SERVICE } from "@/search/domain/interfaces/embedding-service.interface";
import { OpenAIEmbeddingClient } from "@/search/infrastructure/clients/openai-embedding.client";
import { SupabaseSearchClient } from "@/search/infrastructure/clients/supabase-search.client";
import { SearchRepositoryImpl } from "@/search/infrastructure/repositories/search.repository";
import { EmbeddingService } from "@/search/infrastructure/services/embedding.service";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { SEARCH_REPOSITORY } from "./domain/interfaces/search-repository.interface";

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
        SupabaseAdminService,
    ],
    exports: [
        SearchService,
        EmbeddingService,
        SEARCH_REPOSITORY,
        EMBEDDING_SERVICE,
    ],
})
export class SearchModule {}
