import { Injectable, Logger } from '@nestjs/common'
import { SupabaseRequestService } from 'src/supabase-request.service'
import { Database } from 'src/types/schema'

type UserSubscriptionsTable = Database['public']['Tables']['user_subscriptions']
type UserSubscriptionsRow = UserSubscriptionsTable['Row']
type UserSubscriptionsUpdate = UserSubscriptionsTable['Update']

@Injectable()
export class SubscriptionRepository {
    private readonly logger = new Logger(SubscriptionRepository.name)

    constructor(private readonly supabaseRequestService: SupabaseRequestService) {}

    async findByUserId(userId: string) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)

        if (error) {
            this.logger.error(`findByUserId failed: ${error.message}`, error)
            throw error
        }
        return data ?? []
    }

    async insertSubscription(userId: string, feedUrl: string, feedTitle: string) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                feed_url: feedUrl,
                feed_title: feedTitle,
            })
            .select()
            .single()

        if (error) {
            this.logger.error(`insertSubscription failed: ${error.message}`, error)
            throw error
        }
        return data
    }

    async findOne(subscriptionId: number, userId: string) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('id', subscriptionId)
            .eq('user_id', userId)
            .single()

        if (error && error.code !== 'PGRST116') {
            this.logger.error(`findOne failed: ${error.message}`, error)
            throw error
        }
        if (error && error.code === 'PGRST116') {
            return null
        }
        return data
    }

    async updateFetchTimestamps(
        subscriptionId: number,
        userId: string,
        lastFetchedAt: Date,
        nextFetchAt: Date,
    ) {
        const supabase = this.supabaseRequestService.getClient()
        const { error } = await supabase
            .from('user_subscriptions')
            .update({
                last_fetched_at: lastFetchedAt.toISOString(),
                next_fetch_at: nextFetchAt.toISOString(),
            })
            .eq('id', subscriptionId)
            .eq('user_id', userId)

        if (error) {
            this.logger.error(`updateFetchTimestamps failed: ${error.message}`, error)
            throw error
        }
    }

    async findByRefreshInterval(interval: Database['public']['Enums']['refresh_interval_enum']) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            // eq() に文字列ではなく enum型の値を渡す
            .eq('refresh_interval', interval)

        if (error) {
            this.logger.error(`findByRefreshInterval failed: ${error.message}`, error)
            throw error
        }
        return data ?? []
    }

    // 購読情報の部分更新
    async updateSubscription(
        subscriptionId: number,
        userId: string,
        fields: Partial<Pick<UserSubscriptionsRow, 'refresh_interval' | 'feed_title'>>,
    ): Promise<UserSubscriptionsRow> {
        const supabase = this.supabaseRequestService.getClient()

        // 更新データを型安全に整形
        const updateData: UserSubscriptionsUpdate = {}
        if (fields.refresh_interval !== undefined) {
            // refresh_interval は enum
            updateData.refresh_interval = fields.refresh_interval
        }
        if (fields.feed_title !== undefined) {
            updateData.feed_title = fields.feed_title
        }

        const { data, error } = await supabase
            .from('user_subscriptions')
            .update(updateData)
            .eq('id', subscriptionId)
            .eq('user_id', userId)
            .select() // 更新後のレコードを取得
            .single()

        if (error) {
            this.logger.error(`updateSubscription failed: ${error.message}`, error)
            throw error
        }
        return data
    }

    // 購読を削除
    async deleteSubscription(subscriptionId: number, userId: string): Promise<void> {
        const supabase = this.supabaseRequestService.getClient()

        const { error } = await supabase
            .from('user_subscriptions')
            .delete()
            .eq('id', subscriptionId)
            .eq('user_id', userId)

        if (error) {
            this.logger.error(`deleteSubscription failed: ${error.message}`, error)
            throw error
        }
    }
}
