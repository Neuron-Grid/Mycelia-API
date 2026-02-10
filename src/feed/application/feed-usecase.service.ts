import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Item as FeedparserItem, Meta } from "feedparser";
import { EmbeddingQueueService } from "@/embedding/queue/embedding-queue.service";
import { WorkerFeedItemRepository } from "@/feed/infrastructure/worker-feed-item.repository";
import { WorkerSubscriptionRepository } from "@/feed/infrastructure/worker-subscription.repository";
import { FeedFetchService } from "./feed-fetch.service";

type FeedItemLinks = Array<{ rel?: string | null; href?: string | null }>;

type NormalizedFeedItem = {
    title: string;
    link: string;
    description: string;
    canonicalUrl: string | null;
    publishedAt: Date | null;
};

type FetchFeedItemsResult = {
    feedTitle: string;
    insertedCount: number;
    lastFetchedAt: Date;
};

const MAX_TITLE_LENGTH = 1024;
const MAX_DESCRIPTION_LENGTH = 8192;
const MAX_URL_LENGTH = 2048;

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const truncate = (value: string, maxLength: number): string =>
    value.length > maxLength ? value.substring(0, maxLength) : value;

const coerceNullableString = (value: unknown): string | null =>
    typeof value === "string" ? value : null;

const pickFirstString = (...values: Array<string | null | undefined>): string =>
    values.find((value) => value !== null && value !== undefined) ?? "";

const coerceValidDate = (value: Date | null): Date | null => {
    if (!value) return null;
    return Number.isNaN(value.getTime()) ? null : value;
};

const normalizeFeedItem = (item: FeedparserItem): NormalizedFeedItem | null => {
    const link = (coerceNullableString(item.link) ?? "").trim();
    if (!link) return null;

    const title = coerceNullableString(item.title) ?? "(no title)";

    const descriptionRaw = pickFirstString(
        coerceNullableString(item.summary),
        coerceNullableString(item.description),
    );

    const extras = item as Partial<{
        origlink: string;
        links: FeedItemLinks;
    }>;
    const origlink =
        typeof extras.origlink === "string" ? extras.origlink : null;
    const links = Array.isArray(extras.links) ? extras.links : [];
    const canonicalFromLinks = links.find(
        (entry) => entry?.rel === "canonical" && entry.href,
    )?.href;
    const alternateLink = links.find(
        (entry) => (!entry?.rel || entry.rel === "alternate") && entry.href,
    )?.href;
    const canonicalCandidate =
        origlink ?? canonicalFromLinks ?? alternateLink ?? null;

    return {
        title: truncate(title, MAX_TITLE_LENGTH),
        link: truncate(link, MAX_URL_LENGTH),
        description: truncate(descriptionRaw, MAX_DESCRIPTION_LENGTH),
        canonicalUrl: canonicalCandidate
            ? truncate(canonicalCandidate, MAX_URL_LENGTH)
            : null,
        publishedAt: coerceValidDate(
            item.pubdate ? new Date(item.pubdate) : null,
        ),
    };
};

@Injectable()
export class FeedUseCaseService {
    private readonly logger = new Logger(FeedUseCaseService.name);

    constructor(
        private readonly fetchSvc: FeedFetchService,
        private readonly workerSubs: WorkerSubscriptionRepository,
        private readonly workerItems: WorkerFeedItemRepository,
        @Optional()
        @Inject(EmbeddingQueueService)
        private readonly embeddingQueueService: EmbeddingQueueService | null,
    ) {}

    fetchFeedMeta(
        feedUrl: string,
    ): Promise<{ meta: Meta; items: FeedparserItem[] }> {
        return this.fetchSvc.parseFeed(feedUrl);
    }

    // RSSをfetch→DB反映→last_fetched_at更新
    async fetchFeedItems(
        subscriptionId: number,
        userId: string,
    ): Promise<FetchFeedItemsResult> {
        const sub = await this.workerSubs.getByIdForUser(
            userId,
            subscriptionId,
        );
        if (!sub) {
            throw new Error(`Subscription not found (id=${subscriptionId})`);
        }
        const { feed_url: feedUrl, feed_title: feedTitle } = sub;
        const { meta, items } = await this.fetchSvc.parseFeed(feedUrl);
        let inserted = 0;
        for (const item of items) {
            const normalized = normalizeFeedItem(item);
            if (!normalized) continue;
            try {
                const res = await this.workerItems.insertFeedItem(
                    subscriptionId,
                    userId,
                    normalized.title,
                    normalized.link,
                    normalized.description,
                    normalized.publishedAt,
                    normalized.canonicalUrl,
                );
                if (res.inserted) inserted++;
                else this.logger.verbose(`dup: ${normalized.link}`);
            } catch (e) {
                this.logger.warn(
                    `failed: ${normalized.link} – ${getErrorMessage(e)}`,
                );
            }
        }
        const fetchedAt = new Date();
        await this.workerSubs.markFetched(userId, subscriptionId, fetchedAt);

        // 新しいフィードアイテムが追加された場合、埋め込み生成ジョブをキューに追加
        if (inserted > 0 && this.embeddingQueueService) {
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
                    `Failed to queue embedding generation: ${getErrorMessage(
                        error,
                    )}`,
                );
            }
        }

        return {
            feedTitle: meta.title ?? feedTitle,
            insertedCount: inserted,
            lastFetchedAt: fetchedAt,
        };
    }
}
