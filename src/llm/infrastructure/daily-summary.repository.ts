import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { SupabaseRequestService } from '../../supabase-request.service'
import { DailySummaryEntity, DailySummaryItemEntity } from '../domain/daily-summary.entity'

@Injectable()
export class DailySummaryRepository {
    private readonly logger = new Logger(DailySummaryRepository.name)

    constructor(private readonly supabaseRequestService: SupabaseRequestService) {}

    // 指定ユーザーの指定日の要約を取得
    async findByUserAndDate(
        userId: string,
        summaryDate: string,
    ): Promise<DailySummaryEntity | null> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('daily_summaries')
                .select('*')
                .eq('user_id', userId)
                .eq('summary_date', summaryDate)
                .eq('soft_deleted', false)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    return null
                }
                throw error
            }

            return new DailySummaryEntity(data)
        } catch (error) {
            this.logger.error(`Failed to find daily summary: ${error.message}`)
            return null
        }
    }

    // 要約の作成
    async create(
        userId: string,
        summaryDate: string,
        data: {
            markdown?: string
            summary_title?: string
            summary_embedding?: number[]
        },
    ): Promise<DailySummaryEntity> {
        try {
            const { data: result, error } = await this.supabaseRequestService
                .getClient()
                .from('daily_summaries')
                .insert({
                    user_id: userId,
                    summary_date: summaryDate,
                    markdown: data.markdown || null,
                    summary_title: data.summary_title || null,
                    summary_embedding: data.summary_embedding || null,
                    soft_deleted: false,
                })
                .select()
                .single()

            if (error) throw error
            return new DailySummaryEntity(result)
        } catch (error) {
            this.logger.error(`Failed to create daily summary: ${error.message}`)
            throw error
        }
    }

    // 要約の更新
    async update(
        id: number,
        userId: string,
        data: {
            markdown?: string
            summary_title?: string
            summary_embedding?: number[]
            script_text?: string
            script_tts_duration_sec?: number
        },
    ): Promise<DailySummaryEntity> {
        try {
            const { data: result, error } = await this.supabaseRequestService
                .getClient()
                .from('daily_summaries')
                .update({
                    ...data,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('user_id', userId) // ユーザー分離の保証
                .eq('soft_deleted', false)
                .select()
                .single()

            if (error) throw error
            if (!result) {
                throw new NotFoundException('Daily summary not found or access denied')
            }

            return new DailySummaryEntity(result)
        } catch (error) {
            this.logger.error(`Failed to update daily summary: ${error.message}`)
            throw error
        }
    }

    // 指定ユーザーの要約一覧取得（ページネーション対応）
    async findByUser(userId: string, limit = 20, offset = 0): Promise<DailySummaryEntity[]> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('daily_summaries')
                .select('*')
                .eq('user_id', userId)
                .eq('soft_deleted', false)
                .order('summary_date', { ascending: false })
                .range(offset, offset + limit - 1)

            if (error) throw error
            return data.map((item) => new DailySummaryEntity(item))
        } catch (error) {
            this.logger.error(`Failed to find daily summaries: ${error.message}`)
            return []
        }
    }

    // 要約アイテムの追加（ユーザー分離の保証付き）
    async addSummaryItems(summaryId: number, userId: string, feedItemIds: number[]): Promise<void> {
        try {
            // まず、summaryIdがこのユーザーのものであることを確認
            const summary = await this.supabaseRequestService
                .getClient()
                .from('daily_summaries')
                .select('id')
                .eq('id', summaryId)
                .eq('user_id', userId)
                .single()

            if (summary.error || !summary.data) {
                throw new Error('Summary not found or access denied')
            }

            // feedItemIdsがこのユーザーのものであることを確認
            const { data: feedItems, error: feedError } = await this.supabaseRequestService
                .getClient()
                .from('feed_items')
                .select('id')
                .eq('user_id', userId)
                .in('id', feedItemIds)

            if (feedError) throw feedError

            const validFeedItemIds = feedItems?.map((item) => item.id) || []
            if (validFeedItemIds.length !== feedItemIds.length) {
                throw new Error('Some feed items do not belong to this user')
            }

            const items = validFeedItemIds.map((feedItemId) => ({
                summary_id: summaryId,
                feed_item_id: feedItemId,
            }))

            const { error } = await this.supabaseRequestService
                .getClient()
                .from('daily_summary_items')
                .insert(items)

            if (error) throw error
        } catch (error) {
            this.logger.error(`Failed to add summary items: ${error.message}`)
            throw error
        }
    }

    // 要約に含まれるフィードアイテムを取得（ユーザー分離の保証付き）
    async getSummaryItems(summaryId: number, userId: string): Promise<DailySummaryItemEntity[]> {
        try {
            // まず、summaryIdがこのユーザーのものであることを確認
            const summary = await this.supabaseRequestService
                .getClient()
                .from('daily_summaries')
                .select('id')
                .eq('id', summaryId)
                .eq('user_id', userId)
                .single()

            if (summary.error || !summary.data) {
                throw new Error('Summary not found or access denied')
            }

            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('daily_summary_items')
                .select('*')
                .eq('summary_id', summaryId)

            if (error) throw error
            return data.map((item) => new DailySummaryItemEntity(item))
        } catch (error) {
            this.logger.error(`Failed to get summary items: ${error.message}`)
            return []
        }
    }

    // ユーザーの最新24時間以内のフィードアイテムを取得（要約生成用）
    async getRecentFeedItems(
        userId: string,
        hoursBack = 24,
    ): Promise<
        {
            id: number
            title: string
            description: string
            link: string
            publication_date: string
            feed_id: number
        }[]
    > {
        try {
            const cutoffTime = new Date()
            cutoffTime.setHours(cutoffTime.getHours() - hoursBack)

            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('feed_items')
                .select(`
                    id,
                    title,
                    link,
                    description,
                    published_at,
                    user_subscriptions!inner(feed_title)
                `)
                .eq('user_id', userId)
                .eq('soft_deleted', false)
                .gte('published_at', cutoffTime.toISOString())
                .order('published_at', { ascending: false })

            if (error) throw error
            return data || []
        } catch (error) {
            this.logger.error(`Failed to get recent feed items: ${error.message}`)
            return []
        }
    }

    // 所有者チェック用：指定されたサマリーIDがユーザーのものかを確認
    async findById(id: number, userId: string): Promise<DailySummaryEntity | null> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('daily_summaries')
                .select('*')
                .eq('id', id)
                .eq('user_id', userId)
                .eq('soft_deleted', false)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    return null
                }
                throw error
            }

            return new DailySummaryEntity(data)
        } catch (error) {
            this.logger.error(`Failed to find daily summary by ID: ${error.message}`)
            return null
        }
    }

    // ソフト削除
    async softDelete(id: number, userId: string): Promise<void> {
        try {
            const { error } = await this.supabaseRequestService
                .getClient()
                .from('daily_summaries')
                .update({
                    soft_deleted: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('user_id', userId) // ユーザー分離の保証

            if (error) throw error
        } catch (error) {
            this.logger.error(`Failed to soft delete daily summary: ${error.message}`)
            throw error
        }
    }
}
