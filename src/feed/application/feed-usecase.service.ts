import { Injectable, Logger } from '@nestjs/common'
import { Item as FeedparserItem, Meta } from 'feedparser'
import { FeedFetchService } from './feed-fetch.service'
import { FeedItemService } from './feed-item.service'
import { SubscriptionService } from './subscription.service'

@Injectable()
export class FeedUseCaseService {
    private readonly logger = new Logger(FeedUseCaseService.name)

    constructor(
        private readonly feedFetchService: FeedFetchService,
        private readonly subscriptionService: SubscriptionService,
        private readonly feedItemService: FeedItemService,
    ) {}

    // RSSのメタ情報だけ欲しいとき
    async fetchFeedMeta(feedUrl: string): Promise<{ meta: Meta; items: FeedparserItem[] }> {
        return await this.feedFetchService.parseFeed(feedUrl)
    }

    // フィードをfetchしてDBに挿入
    async fetchFeedItems(subscriptionId: number, userId: string) {
        // 購読情報を取得
        const subscription = await this.subscriptionService.getSubscriptionById(
            userId,
            subscriptionId,
        )
        if (!subscription) {
            throw new Error(`Subscription not found (ID=${subscriptionId}, user_id=${userId})`)
        }

        const { feed_url, refresh_interval, feed_title } = subscription

        // RSSパース
        const feedData = await this.feedFetchService.parseFeed(feed_url)
        const metaTitle = feedData.meta.title ?? feed_title
        let insertedCount = 0

        // 新着アイテムをDB登録
        for (const item of feedData.items) {
            const link = item.link ?? ''
            if (!link) continue

            const title = item.title ?? '(no title)'
            const publishedAt = item.pubdate ? new Date(item.pubdate) : null
            const description = item.summary ?? item.description ?? ''
            try {
                const error = await this.feedItemService.insertFeedItem(
                    subscriptionId,
                    userId,
                    title.substring(0, 1024),
                    link.substring(0, 2048),
                    description,
                    publishedAt,
                )
                if (!error) {
                    insertedCount++
                } else if (error.message.includes('duplicate key')) {
                    this.logger.verbose(`Duplicate link skipped: ${link}`)
                } else {
                    this.logger.warn(`Insert error: ${error.message}`)
                }
            } catch (err) {
                this.logger.warn(`Failed to insert feed item: ${link} : ${err}`)
            }
        }

        // last_fetched_at, next_fetch_at 更新
        const lastFetchedAt = new Date()
        const nextFetchAt = this.calcNextFetchTime(lastFetchedAt, refresh_interval || '30minute')
        await this.subscriptionService.updateFetchTimestamps(
            subscriptionId,
            userId,
            lastFetchedAt,
            nextFetchAt,
        )

        return {
            feedTitle: metaTitle,
            insertedCount,
            lastFetchedAt,
            nextFetchAt,
        }
    }

    private calcNextFetchTime(fromDate: Date, interval: string): Date {
        const next = new Date(fromDate)
        const map: Record<string, number> = {
            '5minute': 5,
            '10minute': 10,
            '30minute': 30,
            '1hour': 60,
            '2hour': 120,
            '4hour': 240,
            '6hour': 360,
            '12hour': 720,
        }
        const minutes = map[interval] ?? 30
        next.setMinutes(next.getMinutes() + minutes)
        return next
    }
}
