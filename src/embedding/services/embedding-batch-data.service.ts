import { Injectable, Logger } from '@nestjs/common'
import { SupabaseRequestService } from '../../supabase-request.service'
import {
    EmbeddingBatchException,
    InvalidTableTypeException,
} from '../exceptions/embedding-batch.exceptions'
import { IBatchDataService } from '../interfaces/batch-data.interface'
import {
    BatchItem,
    FeedItemBatch,
    PodcastBatch,
    SummaryBatch,
    TableType,
    TagBatch,
} from '../types/embedding-batch.types'

@Injectable()
export class EmbeddingBatchDataService implements IBatchDataService {
    private readonly logger = new Logger(EmbeddingBatchDataService.name)

    constructor(private readonly supabaseRequestService: SupabaseRequestService) {}

    async getFeedItemsBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<FeedItemBatch[]> {
        try {
            const query = this.supabaseRequestService
                .getClient()
                .from('feed_items')
                .select('id, title, description')
                .eq('user_id', userId)
                .is('title_embedding', null)
                .eq('soft_deleted', false)
                .limit(batchSize)
                .order('id')

            if (lastId) {
                query.gt('id', lastId)
            }

            const { data, error } = await query

            if (error) {
                this.logger.error(`Error fetching feed items batch: ${error.message}`)
                throw error
            }

            return (
                data?.map((item) => ({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    contentText: `${item.title} ${item.description || ''}`.trim(),
                })) || []
            )
        } catch (error) {
            this.logger.error(`Failed to fetch feed items batch: ${error.message}`)
            throw new EmbeddingBatchException(
                `Failed to fetch feed items batch: ${error.message}`,
                userId,
            )
        }
    }

    async getDailySummariesBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<SummaryBatch[]> {
        try {
            const query = this.supabaseRequestService
                .getClient()
                .from('daily_summaries')
                .select('id, summary_title, markdown')
                .eq('user_id', userId)
                .is('summary_embedding', null)
                .eq('soft_deleted', false)
                .limit(batchSize)
                .order('id')

            if (lastId) {
                query.gt('id', lastId)
            }

            const { data, error } = await query

            if (error) {
                this.logger.error(`Error fetching summaries batch: ${error.message}`)
                throw error
            }

            return (
                data?.map((item) => ({
                    id: item.id,
                    summaryTitle: item.summary_title,
                    markdown: item.markdown,
                    contentText: item.markdown,
                })) || []
            )
        } catch (error) {
            this.logger.error(`Failed to fetch summaries batch: ${error.message}`)
            throw new EmbeddingBatchException(
                `Failed to fetch summaries batch: ${error.message}`,
                userId,
            )
        }
    }

    async getPodcastEpisodesBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<PodcastBatch[]> {
        try {
            const query = this.supabaseRequestService
                .getClient()
                .from('podcast_episodes')
                .select('id, title')
                .eq('user_id', userId)
                .is('title_embedding', null)
                .eq('soft_deleted', false)
                .limit(batchSize)
                .order('id')

            if (lastId) {
                query.gt('id', lastId)
            }

            const { data, error } = await query

            if (error) {
                this.logger.error(`Error fetching podcast episodes batch: ${error.message}`)
                throw error
            }

            return (
                data?.map((item) => ({
                    id: item.id,
                    title: item.title,
                    contentText: item.title,
                })) || []
            )
        } catch (error) {
            this.logger.error(`Failed to fetch podcast episodes batch: ${error.message}`)
            throw new EmbeddingBatchException(
                `Failed to fetch podcast episodes batch: ${error.message}`,
                userId,
            )
        }
    }

    async getTagsBatch(userId: string, batchSize: number, lastId?: number): Promise<TagBatch[]> {
        try {
            const query = this.supabaseRequestService
                .getClient()
                .from('tags')
                .select('id, tag_name, description')
                .eq('user_id', userId)
                .is('tag_embedding', null)
                .eq('soft_deleted', false)
                .limit(batchSize)
                .order('id')

            if (lastId) {
                query.gt('id', lastId)
            }

            const { data, error } = await query

            if (error) {
                this.logger.error(`Error fetching tags batch: ${error.message}`)
                throw error
            }

            return (
                data?.map((item) => ({
                    id: item.id,
                    tagName: item.tag_name,
                    description: item.description,
                    contentText: `${item.tag_name} ${item.description || ''}`.trim(),
                })) || []
            )
        } catch (error) {
            this.logger.error(`Failed to fetch tags batch: ${error.message}`)
            throw new EmbeddingBatchException(
                `Failed to fetch tags batch: ${error.message}`,
                userId,
            )
        }
    }

    async getMissingEmbeddingsCount(userId: string, tableType: TableType): Promise<number> {
        try {
            const { count, error } = await this.supabaseRequestService
                .getClient()
                .from(tableType)
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .is(`${this.getEmbeddingColumn(tableType)}`, null)
                .eq('soft_deleted', false)

            if (error) {
                this.logger.error(`Error getting missing embeddings count: ${error.message}`)
                throw error
            }

            return count || 0
        } catch (error) {
            this.logger.error(`Failed to get missing embeddings count: ${error.message}`)
            throw new EmbeddingBatchException(
                `Failed to get missing embeddings count: ${error.message}`,
                userId,
            )
        }
    }

    getBatchData(
        userId: string,
        tableType: TableType,
        batchSize: number,
        lastId?: number,
    ): Promise<BatchItem[]> {
        switch (tableType) {
            case 'feed_items':
                return this.getFeedItemsBatch(userId, batchSize, lastId)
            case 'daily_summaries':
                return this.getDailySummariesBatch(userId, batchSize, lastId)
            case 'podcast_episodes':
                return this.getPodcastEpisodesBatch(userId, batchSize, lastId)
            case 'tags':
                return this.getTagsBatch(userId, batchSize, lastId)
            default:
                throw new InvalidTableTypeException(tableType)
        }
    }

    private getEmbeddingColumn(tableType: TableType): string {
        const columnMap = {
            feed_items: 'title_embedding',
            daily_summaries: 'summary_embedding',
            podcast_episodes: 'title_embedding',
            tags: 'tag_embedding',
        } as const
        return columnMap[tableType]
    }
}
