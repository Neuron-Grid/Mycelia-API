import { Injectable, Logger } from "@nestjs/common";
import { Item as FeedparserItem, Meta } from "feedparser";
import { EmbeddingQueueService } from "../../embedding/queue/embedding-queue.service";
import { FeedFetchService } from "./feed-fetch.service";
import { FeedItemService } from "./feed-item.service";
import { SubscriptionService } from "./subscription.service";

@Injectable()
export class FeedUseCaseService {
    private readonly logger = new Logger(FeedUseCaseService.name);

    constructor(
        private readonly fetchSvc: FeedFetchService,
        private readonly subSvc: SubscriptionService,
        private readonly itemSvc: FeedItemService,
        private readonly embeddingQueueService: EmbeddingQueueService,
    ) {}

    async fetchFeedMeta(
        feedUrl: string,
    ): Promise<{ meta: Meta; items: FeedparserItem[] }> {
        return await this.fetchSvc.parseFeed(feedUrl);
    }

    // RSSをfetch→DB反映→last_fetched_at更新
    async fetchFeedItems(subscriptionId: number, userId: string) {
        const sub = await this.subSvc.getSubscriptionById(
            userId,
            subscriptionId,
        );
        if (!sub)
            throw new Error(`Subscription not found (id=${subscriptionId})`);
        const { feed_url, feed_title } = sub;
        const { meta, items } = await this.fetchSvc.parseFeed(feed_url);
        let inserted = 0;
        for (const item of items) {
            const link = item.link ?? "";
            if (!link) continue;
            const title = (item.title ?? "(no title)").substring(0, 1024);
            const description = (
                item.summary ??
                item.description ??
                ""
            ).substring(0, 8192);
            const published = item.pubdate ? new Date(item.pubdate) : null;
            try {
                const err = await this.itemSvc.insertFeedItem(
                    subscriptionId,
                    userId,
                    title,
                    link.substring(0, 2048),
                    description,
                    published,
                );
                if (!err) inserted++;
                else if (err.message.includes("duplicate"))
                    this.logger.verbose(`dup: ${link}`);
                else this.logger.warn(`insert error: ${err.message}`);
            } catch (e) {
                this.logger.warn(`failed: ${link} – ${e}`);
            }
        }
        const fetchedAt = new Date();
        await this.subSvc.markFetched(subscriptionId, userId, fetchedAt);

        // 新しいフィードアイテムが追加された場合、埋め込み生成ジョブをキューに追加
        if (inserted > 0) {
            try {
                await this.embeddingQueueService.addUserEmbeddingBatchJob(
                    userId,
                    ["feed_items"],
                );
                this.logger.debug(
                    `Queued embedding generation for ${inserted} new feed items`,
                );
            } catch (error) {
                this.logger.warn(
                    `Failed to queue embedding generation: ${error.message}`,
                );
            }
        }

        return {
            feedTitle: meta.title ?? feed_title,
            insertedCount: inserted,
            lastFetchedAt: fetchedAt,
        };
    }
}
