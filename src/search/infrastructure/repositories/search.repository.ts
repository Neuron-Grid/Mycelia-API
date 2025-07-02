import { Injectable, Logger } from '@nestjs/common'
import type { SearchResultEntity } from '../../domain/entities/search-result.entity'
import { SearchResult } from '../../domain/entities/search-result.entity'
import type { SearchRepository } from '../../domain/interfaces/search-repository.interface'
import {
    SearchCriteria,
    type SearchCriteria as SearchCriteriaType,
} from '../../domain/value-objects/search-criteria.vo'
import { SupabaseSearchClient } from '../clients/supabase-search.client'
import { EmbeddingService } from '../services/embedding.service'

@Injectable()
export class SearchRepositoryImpl implements SearchRepository {
    private readonly logger = new Logger(SearchRepositoryImpl.name)

    constructor(
        private readonly embeddingService: EmbeddingService,
        private readonly supabaseClient: SupabaseSearchClient,
    ) {}

    async searchFeedItems(
        userId: string,
        criteria: SearchCriteriaType,
    ): Promise<SearchResultEntity[]> {
        try {
            const queryEmbedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(criteria.query),
            )

            const results = await this.supabaseClient.searchFeedItems(
                userId,
                queryEmbedding,
                criteria.threshold,
                criteria.limit,
            )

            return results.map(
                (result) =>
                    new SearchResult(
                        result.id,
                        result.title,
                        result.content,
                        result.similarity,
                        result.type,
                        result.metadata,
                    ),
            )
        } catch (error) {
            this.logger.error(`Failed to search feed items: ${error.message}`)
            return []
        }
    }

    async searchSummaries(
        userId: string,
        criteria: SearchCriteriaType,
    ): Promise<SearchResultEntity[]> {
        try {
            const queryEmbedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(criteria.query),
            )

            const results = await this.supabaseClient.searchSummaries(
                userId,
                queryEmbedding,
                criteria.threshold,
                criteria.limit,
            )

            return results.map(
                (result) =>
                    new SearchResult(
                        result.id,
                        result.title,
                        result.content,
                        result.similarity,
                        result.type,
                        result.metadata,
                    ),
            )
        } catch (error) {
            this.logger.error(`Failed to search summaries: ${error.message}`)
            return []
        }
    }

    async searchPodcastEpisodes(
        userId: string,
        criteria: SearchCriteriaType,
    ): Promise<SearchResultEntity[]> {
        try {
            const queryEmbedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(criteria.query),
            )

            const results = await this.supabaseClient.searchPodcastEpisodes(
                userId,
                queryEmbedding,
                criteria.threshold,
                criteria.limit,
            )

            return results.map(
                (result) =>
                    new SearchResult(
                        result.id,
                        result.title,
                        result.content,
                        result.similarity,
                        result.type,
                        result.metadata,
                    ),
            )
        } catch (error) {
            this.logger.error(`Failed to search podcast episodes: ${error.message}`)
            return []
        }
    }

    async searchAll(userId: string, criteria: SearchCriteriaType): Promise<SearchResultEntity[]> {
        const results: SearchResultEntity[] = []
        const limitPerType = criteria.getLimitPerType()

        try {
            const promises = []

            if (criteria.shouldIncludeFeedItems()) {
                promises.push(
                    this.searchFeedItems(
                        userId,
                        new SearchCriteria({
                            ...criteria,
                            limit: limitPerType,
                        }),
                    ),
                )
            }

            if (criteria.shouldIncludeSummaries()) {
                promises.push(
                    this.searchSummaries(
                        userId,
                        new SearchCriteria({
                            ...criteria,
                            limit: limitPerType,
                        }),
                    ),
                )
            }

            if (criteria.shouldIncludePodcasts()) {
                promises.push(
                    this.searchPodcastEpisodes(
                        userId,
                        new SearchCriteria({
                            ...criteria,
                            limit: limitPerType,
                        }),
                    ),
                )
            }

            const searchResults = await Promise.all(promises)

            for (const result of searchResults) {
                results.push(...result)
            }

            return results.sort((a, b) => b.similarity - a.similarity).slice(0, criteria.limit)
        } catch (error) {
            this.logger.error(`Failed to perform unified search: ${error.message}`)
            return []
        }
    }

    async updateFeedItemEmbedding(
        feedItemId: number,
        userId: string,
        title: string,
        description?: string,
    ): Promise<void> {
        try {
            const content = `${title} ${description || ''}`.trim()
            const embedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(content),
            )

            await this.supabaseClient.updateFeedItemEmbedding(feedItemId, userId, embedding)
        } catch (error) {
            this.logger.error(`Failed to update feed item embedding: ${error.message}`)
            throw error
        }
    }

    async updateSummaryEmbedding(
        summaryId: number,
        userId: string,
        content: string,
    ): Promise<void> {
        try {
            const embedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(content),
            )

            await this.supabaseClient.updateSummaryEmbedding(summaryId, userId, embedding)
        } catch (error) {
            this.logger.error(`Failed to update summary embedding: ${error.message}`)
            throw error
        }
    }

    async updatePodcastEpisodeEmbedding(
        episodeId: number,
        userId: string,
        title: string,
    ): Promise<void> {
        try {
            const embedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(title),
            )

            await this.supabaseClient.updatePodcastEpisodeEmbedding(episodeId, userId, embedding)
        } catch (error) {
            this.logger.error(`Failed to update podcast episode embedding: ${error.message}`)
            throw error
        }
    }
}
