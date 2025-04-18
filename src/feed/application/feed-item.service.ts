import { Injectable, Logger } from '@nestjs/common'
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface'
import { Database } from 'src/types/schema'
import { FeedItemRepository } from '../infrastructure/feed-item.repository'

type Row = Database['public']['Tables']['feed_items']['Row']

@Injectable()
export class FeedItemService {
    private readonly logger = new Logger(FeedItemService.name)

    constructor(private readonly feedItemRepo: FeedItemRepository) {}

    async getFeedItemsPaginated(
        userId: string,
        subscriptionId: number,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<Row>> {
        return await this.feedItemRepo.findBySubscriptionIdPaginated(
            subscriptionId,
            userId,
            page,
            limit,
        )
    }

    async insertFeedItem(
        subscriptionId: number,
        userId: string,
        title: string,
        link: string,
        description: string,
        publishedAt: Date | null,
    ) {
        return await this.feedItemRepo.insertFeedItem({
            user_subscription_id: subscriptionId,
            user_id: userId,
            title,
            link,
            description,
            published_at: publishedAt,
        })
    }
}
