import { Injectable, Logger } from '@nestjs/common'
import { SupabaseRequestService } from 'src/supabase-request.service'

@Injectable()
export class FeedItemRepository {
    private readonly logger = new Logger(FeedItemRepository.name)

    constructor(private readonly supabaseRequestService: SupabaseRequestService) {}

    async findBySubscriptionId(subscriptionId: number, userId: string) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase
            .from('feed_items')
            .select('*')
            .eq('user_subscription_id', subscriptionId)
            .eq('user_id', userId)
            .order('published_at', { ascending: false })

        if (error) {
            this.logger.error(`Failed to get feed_items: ${error.message}`, error)
            throw error
        }
        return data ?? []
    }

    // アイテムを追加
    async insertFeedItem(item: {
        user_subscription_id: number
        user_id: string
        title: string
        link: string
        description: string
        published_at: Date | null
    }) {
        const supabase = this.supabaseRequestService.getClient()
        const { error } = await supabase.from('feed_items').insert({
            ...item,
            published_at: item.published_at ? item.published_at.toISOString() : null,
        })

        return error
    }
}
