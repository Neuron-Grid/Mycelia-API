import { jest } from "@jest/globals";
import { FeedUseCaseService } from "./feed-usecase.service";

describe("FeedUseCaseService", () => {
    let fetchSvc: { parseFeed: jest.Mock };
    let workerSubs: { getByIdForUser: jest.Mock; markFetched: jest.Mock };
    let workerItems: { insertFeedItem: jest.Mock };
    let embeddingQueueService: { addUserEmbeddingBatchJob: jest.Mock };
    let service: FeedUseCaseService;

    const userId = "user-1";
    const subscriptionId = 123;

    beforeEach(() => {
        jest.useFakeTimers();
        fetchSvc = {
            parseFeed: jest.fn().mockResolvedValue({
                meta: { title: "" },
                items: [],
            }),
        };
        workerSubs = {
            getByIdForUser: jest.fn().mockResolvedValue(null),
            markFetched: jest.fn().mockResolvedValue(undefined),
        };
        workerItems = {
            insertFeedItem: jest
                .fn()
                .mockResolvedValue({ id: null, inserted: false }),
        };
        embeddingQueueService = {
            addUserEmbeddingBatchJob: jest.fn().mockResolvedValue(undefined),
        };

        service = new FeedUseCaseService(
            fetchSvc as never,
            workerSubs as never,
            workerItems as never,
            embeddingQueueService as never,
        );
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const buildSubscription = () => ({
        id: subscriptionId,
        user_id: userId,
        feed_url: "https://example.com/rss",
        feed_title: "Stored title",
    });

    it("queues embedding job when new items are inserted", async () => {
        jest.setSystemTime(new Date("2025-10-17T01:30:00Z"));
        workerSubs.getByIdForUser.mockResolvedValue(buildSubscription());
        fetchSvc.parseFeed.mockResolvedValue({
            meta: { title: "Fetched title" },
            items: [
                {
                    title: "First post",
                    link: "https://example.com/post-1",
                    summary: "Post summary",
                    pubdate: new Date("2025-10-16T12:00:00Z"),
                    origlink: "https://canonical.example.com/post-1",
                },
                {
                    title: "Second post",
                    link: "https://example.com/post-2",
                    description: "Longer description",
                },
            ],
        });
        workerItems.insertFeedItem
            .mockResolvedValueOnce({ id: 1, inserted: true })
            .mockResolvedValueOnce({ id: 2, inserted: false });

        const result = await service.fetchFeedItems(subscriptionId, userId);

        expect(workerSubs.getByIdForUser).toHaveBeenCalledWith(
            userId,
            subscriptionId,
        );
        expect(workerItems.insertFeedItem).toHaveBeenNthCalledWith(
            1,
            subscriptionId,
            userId,
            "First post",
            "https://example.com/post-1",
            "Post summary",
            new Date("2025-10-16T12:00:00Z"),
            "https://canonical.example.com/post-1",
        );
        expect(workerItems.insertFeedItem).toHaveBeenNthCalledWith(
            2,
            subscriptionId,
            userId,
            "Second post",
            "https://example.com/post-2",
            "Longer description",
            null,
            null,
        );
        expect(workerSubs.markFetched).toHaveBeenCalledWith(
            userId,
            subscriptionId,
            new Date("2025-10-17T01:30:00.000Z"),
        );
        expect(
            embeddingQueueService.addUserEmbeddingBatchJob,
        ).toHaveBeenCalledWith(userId, ["feed_items"]);
        expect(result.feedTitle).toBe("Fetched title");
        expect(result.insertedCount).toBe(1);
        expect(result.lastFetchedAt).toEqual(
            new Date("2025-10-17T01:30:00.000Z"),
        );
    });

    it("does not queue embedding job when no new items were inserted and derives canonical from links", async () => {
        jest.setSystemTime(new Date("2025-10-17T03:00:00Z"));
        workerSubs.getByIdForUser.mockResolvedValue(buildSubscription());
        fetchSvc.parseFeed.mockResolvedValue({
            meta: { title: undefined },
            items: [
                {
                    title: "Item with canonical link",
                    link: "https://example.com/item",
                    description: "desc",
                    links: [
                        {
                            rel: "alternate",
                            href: "https://alt.example.com/item",
                        },
                        {
                            rel: "canonical",
                            href: "https://canonical.example.com/item",
                        },
                    ],
                },
            ],
        });
        workerItems.insertFeedItem.mockResolvedValue({
            id: null,
            inserted: false,
        });

        const result = await service.fetchFeedItems(subscriptionId, userId);

        expect(workerItems.insertFeedItem).toHaveBeenCalledWith(
            subscriptionId,
            userId,
            "Item with canonical link",
            "https://example.com/item",
            "desc",
            null,
            "https://canonical.example.com/item",
        );
        expect(
            embeddingQueueService.addUserEmbeddingBatchJob,
        ).not.toHaveBeenCalled();
        expect(result.feedTitle).toBe("Stored title");
        expect(result.insertedCount).toBe(0);
    });
});
