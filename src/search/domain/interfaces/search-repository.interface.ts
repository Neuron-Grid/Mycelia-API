import type { SearchResultEntity } from "../entities/search-result.entity";
import type { SearchCriteria } from "../value-objects/search-criteria.vo";

export interface SearchRepository {
    searchFeedItems(
        userId: string,
        criteria: SearchCriteria,
    ): Promise<SearchResultEntity[]>;
    searchSummaries(
        userId: string,
        criteria: SearchCriteria,
    ): Promise<SearchResultEntity[]>;
    searchPodcastEpisodes(
        userId: string,
        criteria: SearchCriteria,
    ): Promise<SearchResultEntity[]>;
    searchAll(
        userId: string,
        criteria: SearchCriteria,
    ): Promise<SearchResultEntity[]>;
    updateFeedItemEmbedding(
        feedItemId: number,
        userId: string,
        title: string,
        description?: string,
    ): Promise<void>;
    updateSummaryEmbedding(
        summaryId: number,
        userId: string,
        content: string,
    ): Promise<void>;
    updatePodcastEpisodeEmbedding(
        episodeId: number,
        userId: string,
        title: string,
    ): Promise<void>;
}

export const SEARCH_REPOSITORY = Symbol("SearchRepository");
