import { Injectable, Logger } from '@nestjs/common'
import { SupabaseRequestService } from '../supabase-request.service'
import { EmbeddingService } from './embedding.service'

export interface SearchResult {
    id: number
    title: string
    content: string
    similarity: number
    type: 'feed_item' | 'summary' | 'podcast'
    metadata?: Record<string, any>
}

export interface SearchOptions {
    limit?: number
    threshold?: number
    includeTypes?: ('feed_item' | 'summary' | 'podcast')[]
}

@Injectable()
export class VectorSearchService {
    private readonly logger = new Logger(VectorSearchService.name)

    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        private readonly embeddingService: EmbeddingService,
    ) {}

    // フィードアイテムのベクトル検索
    async searchFeedItems(
        userId: string,
        query: string,
        options: SearchOptions = {},
    ): Promise<SearchResult[]> {
        const { limit = 20, threshold = 0.7 } = options

        try {
            // クエリのベクトル化
            const queryEmbedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(query),
            )

            // PostgreSQLのベクトル検索を実行
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .rpc('search_feed_items_by_vector', {
                    query_embedding: queryEmbedding,
                    match_threshold: threshold,
                    match_count: limit,
                    target_user_id: userId,
                })

            if (error) {
                this.logger.error(`Vector search error: ${error.message}`)
                throw error
            }

            return data.map((item: any) => ({
                id: item.id,
                title: item.title,
                content: item.description || '',
                similarity: item.similarity,
                type: 'feed_item' as const,
                metadata: {
                    link: item.link,
                    published_at: item.published_at,
                    feed_title: item.feed_title,
                },
            }))
        } catch (error) {
            this.logger.error(`Failed to search feed items: ${error.message}`)
            return []
        }
    }

    // 要約のベクトル検索
    async searchSummaries(
        userId: string,
        query: string,
        options: SearchOptions = {},
    ): Promise<SearchResult[]> {
        const { limit = 20, threshold = 0.7 } = options

        try {
            // クエリのベクトル化
            const queryEmbedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(query),
            )

            // PostgreSQLのベクトル検索を実行
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .rpc('search_summaries_by_vector', {
                    query_embedding: queryEmbedding,
                    match_threshold: threshold,
                    match_count: limit,
                    target_user_id: userId,
                })

            if (error) {
                this.logger.error(`Summary vector search error: ${error.message}`)
                throw error
            }

            return data.map((item: any) => ({
                id: item.id,
                title: item.summary_title || 'No Title',
                content: item.markdown || '',
                similarity: item.similarity,
                type: 'summary' as const,
                metadata: {
                    summary_date: item.summary_date,
                    has_script: !!item.script_text,
                },
            }))
        } catch (error) {
            this.logger.error(`Failed to search summaries: ${error.message}`)
            return []
        }
    }

    // ポッドキャストエピソードのベクトル検索
    async searchPodcastEpisodes(
        userId: string,
        query: string,
        options: SearchOptions = {},
    ): Promise<SearchResult[]> {
        const { limit = 20, threshold = 0.7 } = options

        try {
            // クエリのベクトル化
            const queryEmbedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(query),
            )

            // PostgreSQLのベクトル検索を実行
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .rpc('search_podcast_episodes_by_vector', {
                    query_embedding: queryEmbedding,
                    match_threshold: threshold,
                    match_count: limit,
                    target_user_id: userId,
                })

            if (error) {
                this.logger.error(`Podcast vector search error: ${error.message}`)
                throw error
            }

            return data.map((item: any) => ({
                id: item.id,
                title: item.title || 'No Title',
                content: item.title || '',
                similarity: item.similarity,
                type: 'podcast' as const,
                metadata: {
                    audio_url: item.audio_url,
                    summary_id: item.summary_id,
                    created_at: item.created_at,
                },
            }))
        } catch (error) {
            this.logger.error(`Failed to search podcast episodes: ${error.message}`)
            return []
        }
    }

    // 統合検索（全タイプを横断検索）
    async searchAll(
        userId: string,
        query: string,
        options: SearchOptions = {},
    ): Promise<SearchResult[]> {
        const { includeTypes = ['feed_item', 'summary', 'podcast'], limit = 20 } = options
        const results: SearchResult[] = []

        // 各タイプごとの制限を調整
        const limitPerType = Math.ceil(limit / includeTypes.length)

        try {
            const promises = []

            if (includeTypes.includes('feed_item')) {
                promises.push(
                    this.searchFeedItems(userId, query, { ...options, limit: limitPerType }),
                )
            }

            if (includeTypes.includes('summary')) {
                promises.push(
                    this.searchSummaries(userId, query, { ...options, limit: limitPerType }),
                )
            }

            if (includeTypes.includes('podcast')) {
                promises.push(
                    this.searchPodcastEpisodes(userId, query, { ...options, limit: limitPerType }),
                )
            }

            const searchResults = await Promise.all(promises)

            // 結果をマージして類似度でソート
            for (const result of searchResults) {
                results.push(...result)
            }

            return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
        } catch (error) {
            this.logger.error(`Failed to perform unified search: ${error.message}`)
            return []
        }
    }

    // フィードアイテムのベクトル埋め込みを更新
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

            const { error } = await this.supabaseRequestService
                .getClient()
                .from('feed_items')
                .update({ title_emb: embedding })
                .eq('id', feedItemId)
                .eq('user_id', userId)

            if (error) throw error

            this.logger.debug(`Updated embedding for feed item ${feedItemId}`)
        } catch (error) {
            this.logger.error(`Failed to update feed item embedding: ${error.message}`)
            throw error
        }
    }

    // 要約のベクトル埋め込みを更新
    async updateSummaryEmbedding(
        summaryId: number,
        userId: string,
        content: string,
    ): Promise<void> {
        try {
            const embedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(content),
            )

            const { error } = await this.supabaseRequestService
                .getClient()
                .from('daily_summaries')
                .update({ summary_emb: embedding })
                .eq('id', summaryId)
                .eq('user_id', userId)

            if (error) throw error

            this.logger.debug(`Updated embedding for summary ${summaryId}`)
        } catch (error) {
            this.logger.error(`Failed to update summary embedding: ${error.message}`)
            throw error
        }
    }

    // ポッドキャストエピソードのベクトル埋め込みを更新
    async updatePodcastEpisodeEmbedding(
        episodeId: number,
        userId: string,
        title: string,
    ): Promise<void> {
        try {
            const embedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(title),
            )

            const { error } = await this.supabaseRequestService
                .getClient()
                .from('podcast_episodes')
                .update({ title_emb: embedding })
                .eq('id', episodeId)
                .eq('user_id', userId)

            if (error) throw error

            this.logger.debug(`Updated embedding for podcast episode ${episodeId}`)
        } catch (error) {
            this.logger.error(`Failed to update podcast episode embedding: ${error.message}`)
            throw error
        }
    }
}
