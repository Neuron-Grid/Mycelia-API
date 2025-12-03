import { Module } from "@nestjs/common";
import { EMBEDDING_SERVICE } from "@/search/domain/interfaces/embedding-service.interface";
import { SEARCH_REPOSITORY } from "@/search/domain/interfaces/search-repository.interface";
import { OpenAIEmbeddingClient } from "@/search/infrastructure/clients/openai-embedding.client";
import { SupabaseSearchAdminClient } from "@/search/infrastructure/clients/supabase-search-admin.client";
import { SearchRepositoryAdminImpl } from "@/search/infrastructure/repositories/search-admin.repository";
import { EmbeddingService } from "@/search/infrastructure/services/embedding.service";
import { SupabaseAdminModule } from "@/shared/supabase-admin.module";

@Module({
    imports: [SupabaseAdminModule],
    providers: [
        EmbeddingService,
        OpenAIEmbeddingClient,
        SupabaseSearchAdminClient,
        {
            provide: SEARCH_REPOSITORY,
            useClass: SearchRepositoryAdminImpl,
        },
        {
            provide: EMBEDDING_SERVICE,
            useClass: EmbeddingService,
        },
    ],
    exports: [
        EmbeddingService,
        EMBEDDING_SERVICE,
        SEARCH_REPOSITORY,
        OpenAIEmbeddingClient,
        SupabaseSearchAdminClient,
    ],
})
export class SearchWorkerModule {}
