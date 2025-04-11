import { Injectable, Logger } from '@nestjs/common'
import { SupabaseRequestService } from 'src/supabase-request.service'

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
        return data
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

        if (error) {
            this.logger.error(`findOne failed: ${error.message}`, error)
            throw error
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
}
