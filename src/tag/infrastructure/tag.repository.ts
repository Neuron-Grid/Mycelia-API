import { Injectable, Logger } from '@nestjs/common'
import { SupabaseRequestService } from 'src/supabase-request.service'
import { Database } from 'src/types/schema'

// tagsテーブル
type TagsTable = Database['public']['Tables']['tags']
type TagsRow = TagsTable['Row']
type TagsInsert = TagsTable['Insert']
type TagsUpdate = TagsTable['Update']

// feed_item_tagsテーブル
type FeedItemTagsTable = Database['public']['Tables']['feed_item_tags']
type FeedItemTagsInsert = FeedItemTagsTable['Insert']
type FeedItemTagsRow = FeedItemTagsTable['Row']

// user_subscription_tagsテーブル
type SubscriptionTagsTable = Database['public']['Tables']['user_subscription_tags']
type SubscriptionTagsInsert = SubscriptionTagsTable['Insert']
type SubscriptionTagsRow = SubscriptionTagsTable['Row']

@Injectable()
export class TagRepository {
    private readonly logger = new Logger(TagRepository.name)

    constructor(private readonly supabaseService: SupabaseRequestService) {}

    // ユーザーが持つ全タグを取得
    async findAllTagsByUserId(userId: string): Promise<TagsRow[]> {
        const supabase = this.supabaseService.getClient()
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .eq('user_id', userId)
            .order('id', { ascending: true })

        if (error) {
            this.logger.error(`findAllTagsByUserId failed: ${error.message}`, error)
            throw error
        }
        return data ?? []
    }

    // タグを新規作成
    async createTag(
        userId: string,
        tagName: string,
        parentTagId?: number | null,
    ): Promise<TagsRow> {
        const supabase = this.supabaseService.getClient()
        const insertData: TagsInsert = {
            user_id: userId,
            tag_name: tagName,
            parent_tag_id: parentTagId ?? null,
        }

        const { data, error } = await supabase.from('tags').insert(insertData).select().single()

        if (error) {
            this.logger.error(`createTag failed: ${error.message}`, error)
            throw error
        }
        return data
    }

    // タグを更新
    async updateTag(userId: string, tagId: number, fields: Partial<TagsUpdate>): Promise<TagsRow> {
        const supabase = this.supabaseService.getClient()

        // parent_tag_idの所有者確認
        if (fields.parent_tag_id !== undefined) {
            if (fields.parent_tag_id !== null) {
                // ここに来る時点で型はnumber
                const parentTagId = fields.parent_tag_id
                const { data: parent, error: pe } = await supabase
                    .from('tags')
                    .select('id')
                    .eq('id', parentTagId)
                    .eq('user_id', userId)
                    .single()
                if (pe || !parent) {
                    throw new Error('Parent tag does not belong to the user')
                }
            }
        }

        // 実更新
        const { data, error } = await supabase
            .from('tags')
            .update(fields)
            .eq('id', tagId)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw error
        return data
    }

    // タグ削除
    async deleteTag(userId: string, tagId: number): Promise<void> {
        const supabase = this.supabaseService.getClient()
        const { error } = await supabase.from('tags').delete().eq('id', tagId).eq('user_id', userId)

        if (error) {
            this.logger.error(`deleteTag failed: ${error.message}`, error)
            throw error
        }
    }

    // FeedItemにタグを紐付け
    async attachTagToFeedItem(userId: string, feedItemId: number, tagId: number): Promise<void> {
        const supabase = this.supabaseService.getClient()
        const insertData: FeedItemTagsInsert = {
            user_id: userId,
            feed_item_id: feedItemId,
            tag_id: tagId,
        }

        const { error } = await supabase.from('feed_item_tags').insert(insertData)

        if (error) {
            // 重複登録などで UNIQUE制約エラーが起きる場合あり
            this.logger.error(`attachTagToFeedItem failed: ${error.message}`, error)
            throw error
        }
    }

    // FeedItemからタグを外す
    async detachTagFromFeedItem(userId: string, feedItemId: number, tagId: number): Promise<void> {
        const supabase = this.supabaseService.getClient()
        const { error } = await supabase
            .from('feed_item_tags')
            .delete()
            .eq('user_id', userId)
            .eq('feed_item_id', feedItemId)
            .eq('tag_id', tagId)

        if (error) {
            this.logger.error(`detachTagFromFeedItem failed: ${error.message}`, error)
            throw error
        }
    }

    // 指定FeedItemに付与されているタグ一覧を取得
    async findTagsByFeedItem(
        userId: string,
        feedItemId: number,
    ): Promise<Array<FeedItemTagsRow & { tag: TagsRow }>> {
        const supabase = this.supabaseService.getClient()
        const { data, error } = await supabase
            .from('feed_item_tags')
            .select('*, tag:tags(*)')
            .eq('user_id', userId)
            .eq('feed_item_id', feedItemId)

        if (error) {
            this.logger.error(`findTagsByFeedItem failed: ${error.message}`, error)
            throw error
        }

        // dataはfeed_item_tagsのRow & { tag: TagsRow }の構造
        return data ?? []
    }

    // 購読(UserSubscription)にタグを紐づけ
    async attachTagToSubscription(
        userId: string,
        subscriptionId: number,
        tagId: number,
    ): Promise<void> {
        const supabase = this.supabaseService.getClient()
        const insertData: SubscriptionTagsInsert = {
            user_id: userId,
            user_subscription_id: subscriptionId,
            tag_id: tagId,
        }

        const { error } = await supabase.from('user_subscription_tags').insert(insertData)

        if (error) {
            this.logger.error(`attachTagToSubscription failed: ${error.message}`, error)
            throw error
        }
    }

    // 購読(UserSubscription)からタグを外す
    async detachTagFromSubscription(
        userId: string,
        subscriptionId: number,
        tagId: number,
    ): Promise<void> {
        const supabase = this.supabaseService.getClient()
        const { error } = await supabase
            .from('user_subscription_tags')
            .delete()
            .eq('user_id', userId)
            .eq('user_subscription_id', subscriptionId)
            .eq('tag_id', tagId)

        if (error) {
            this.logger.error(`detachTagFromSubscription failed: ${error.message}`, error)
            throw error
        }
    }

    // 指定UserSubscription(購読)に付与されているタグ一覧を取得
    async findTagsBySubscription(
        userId: string,
        subscriptionId: number,
    ): Promise<Array<SubscriptionTagsRow & { tag: TagsRow }>> {
        const supabase = this.supabaseService.getClient()
        const { data, error } = await supabase
            .from('user_subscription_tags')
            .select('*, tag:tags(*)')
            .eq('user_id', userId)
            .eq('user_subscription_id', subscriptionId)

        if (error) {
            this.logger.error(`findTagsBySubscription failed: ${error.message}`, error)
            throw error
        }
        return data ?? []
    }
}
