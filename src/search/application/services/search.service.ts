import { Inject, Injectable, Logger } from '@nestjs/common'
import type { SearchResultEntity } from '../../domain/entities/search-result.entity'
import {
    SEARCH_REPOSITORY,
    type SearchRepository,
} from '../../domain/interfaces/search-repository.interface'
import {
    SearchCriteria,
    type SearchCriteriaData,
} from '../../domain/value-objects/search-criteria.vo'

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name)

    constructor(
        @Inject(SEARCH_REPOSITORY)
        private readonly searchRepository: SearchRepository,
    ) {}

    async searchAll(userId: string, searchData: SearchCriteriaData): Promise<SearchResultEntity[]> {
        const criteria = new SearchCriteria(searchData)
        this.logger.log(`Searching all content for user ${userId} with query: "${criteria.query}"`)

        return this.searchRepository.searchAll(userId, criteria)
    }

    async searchFeedItems(
        userId: string,
        searchData: SearchCriteriaData,
    ): Promise<SearchResultEntity[]> {
        const criteria = new SearchCriteria(searchData)
        this.logger.log(`Searching feed items for user ${userId} with query: "${criteria.query}"`)

        return this.searchRepository.searchFeedItems(userId, criteria)
    }

    async searchSummaries(
        userId: string,
        searchData: SearchCriteriaData,
    ): Promise<SearchResultEntity[]> {
        const criteria = new SearchCriteria(searchData)
        this.logger.log(`Searching summaries for user ${userId} with query: "${criteria.query}"`)

        return this.searchRepository.searchSummaries(userId, criteria)
    }

    async searchPodcastEpisodes(
        userId: string,
        searchData: SearchCriteriaData,
    ): Promise<SearchResultEntity[]> {
        const criteria = new SearchCriteria(searchData)
        this.logger.log(
            `Searching podcast episodes for user ${userId} with query: "${criteria.query}"`,
        )

        return this.searchRepository.searchPodcastEpisodes(userId, criteria)
    }

    async updateFeedItemEmbedding(
        feedItemId: number,
        userId: string,
        title: string,
        description?: string,
    ): Promise<void> {
        this.logger.log(`Updating embedding for feed item ${feedItemId}`)

        return this.searchRepository.updateFeedItemEmbedding(feedItemId, userId, title, description)
    }

    async updateSummaryEmbedding(
        summaryId: number,
        userId: string,
        content: string,
    ): Promise<void> {
        this.logger.log(`Updating embedding for summary ${summaryId}`)

        return this.searchRepository.updateSummaryEmbedding(summaryId, userId, content)
    }

    async updatePodcastEpisodeEmbedding(
        episodeId: number,
        userId: string,
        title: string,
    ): Promise<void> {
        this.logger.log(`Updating embedding for podcast episode ${episodeId}`)

        return this.searchRepository.updatePodcastEpisodeEmbedding(episodeId, userId, title)
    }
}
