import { Injectable } from "@nestjs/common";
import type { SearchResultEntity } from "@/search/domain/entities/search-result.entity";
import { SearchRepository } from "@/search/domain/interfaces/search-repository.interface";
import type { SearchCriteria } from "@/search/domain/value-objects/search-criteria.vo";
import { SupabaseSearchAdminClient } from "../clients/supabase-search-admin.client";
import { EmbeddingService } from "../services/embedding.service";

/**
 * Workerロール向けのSearchRepository実装。
 * - REQUESTスコープの依存を持たない。
 * - 検索系メソッドはWorkerでは使用しないため未対応とし、安全側で例外を投げる。
 */
@Injectable()
export class SearchRepositoryAdminImpl implements SearchRepository {
    constructor(
        private readonly embeddingService: EmbeddingService,
        private readonly supabaseClient: SupabaseSearchAdminClient,
    ) {}

    private unsupported(): Promise<never> {
        return Promise.reject(
            new Error(
                "Search operations are not available in worker context. Use API SearchModule.",
            ),
        );
    }

    searchFeedItems(_criteria: SearchCriteria): Promise<SearchResultEntity[]> {
        return this.unsupported();
    }

    searchSummaries(_criteria: SearchCriteria): Promise<SearchResultEntity[]> {
        return this.unsupported();
    }

    searchPodcastEpisodes(
        _criteria: SearchCriteria,
    ): Promise<SearchResultEntity[]> {
        return this.unsupported();
    }

    searchAll(_criteria: SearchCriteria): Promise<SearchResultEntity[]> {
        return this.unsupported();
    }

    async updateFeedItemEmbedding(
        feedItemId: number,
        userId: string,
        title: string,
        description?: string,
    ): Promise<void> {
        const content = `${title} ${description ?? ""}`.trim();
        const embedding = await this.embeddingService.generateEmbedding(
            this.embeddingService.preprocessText(content),
        );
        await this.supabaseClient.updateFeedItemEmbedding(
            feedItemId,
            userId,
            embedding,
        );
    }

    async updateSummaryEmbedding(
        summaryId: number,
        userId: string,
        content: string,
    ): Promise<void> {
        const embedding = await this.embeddingService.generateEmbedding(
            this.embeddingService.preprocessText(content),
        );
        await this.supabaseClient.updateSummaryEmbedding(
            summaryId,
            userId,
            embedding,
        );
    }

    async updatePodcastEpisodeEmbedding(
        episodeId: number,
        userId: string,
        title: string,
    ): Promise<void> {
        const embedding = await this.embeddingService.generateEmbedding(
            this.embeddingService.preprocessText(title),
        );
        await this.supabaseClient.updatePodcastEpisodeEmbedding(
            episodeId,
            userId,
            embedding,
        );
    }
}
