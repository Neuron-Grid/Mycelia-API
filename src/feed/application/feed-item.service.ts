import { Injectable, Logger } from '@nestjs/common'
import { FeedItemRepository } from '../infrastructure/feed-item.repository'

@Injectable()
export class FeedItemService {
    private readonly logger = new Logger(FeedItemService.name)

    constructor(private readonly feedItemRepo: FeedItemRepository) {}

    async getFeedItems(userId: string, subscriptionId: number) {
        return await this.feedItemRepo.findBySubscriptionId(subscriptionId, userId)
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
