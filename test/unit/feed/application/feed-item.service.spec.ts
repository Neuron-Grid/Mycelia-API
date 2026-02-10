import type { FavoriteRepository } from "@/favorite/infrastructure/favorite.repository";
import type { TagRepository } from "@/tag/infrastructure/tag.repository";
import type { FeedItemRepository } from "@/feed/infrastructure/feed-item.repository";
import { FeedItemService } from "@/feed/application/feed-item.service";

// FeedItemResponseDto は FeedItemEntity を継承しているため、
// テストでは返却データの構造を直接検証する
describe("FeedItemService", () => {
    let service: FeedItemService;
    let feedItemRepo: jest.Mocked<FeedItemRepository>;
    let favoriteRepo: jest.Mocked<FavoriteRepository>;
    let tagRepo: jest.Mocked<TagRepository>;

    beforeEach(() => {
        feedItemRepo = {
            findBySubscriptionIdPaginated: jest.fn(),
            insertFeedItem: jest.fn(),
        } as unknown as jest.Mocked<FeedItemRepository>;

        favoriteRepo = {
            findFavoritesByFeedItemIds: jest.fn(),
        } as unknown as jest.Mocked<FavoriteRepository>;

        tagRepo = {
            findTagsMapByFeedItemIds: jest.fn(),
        } as unknown as jest.Mocked<TagRepository>;

        service = new FeedItemService(feedItemRepo, favoriteRepo, tagRepo);
    });

    describe("getFeedItemsPaginated", () => {
        it("returns empty data when no items found", async () => {
            feedItemRepo.findBySubscriptionIdPaginated.mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                limit: 10,
            } as any);

            const result = await service.getFeedItemsPaginated("u1", 1, 1, 10);

            expect(result.data).toEqual([]);
            expect(result.total).toBe(0);
            expect(
                feedItemRepo.findBySubscriptionIdPaginated,
            ).toHaveBeenCalledWith(1, "u1", 1, 10);
            // favorites/tags should NOT be fetched when data is empty
            expect(
                favoriteRepo.findFavoritesByFeedItemIds,
            ).not.toHaveBeenCalled();
            expect(tagRepo.findTagsMapByFeedItemIds).not.toHaveBeenCalled();
        });

        it("enriches items with favorites and tags", async () => {
            const mockItems = [
                {
                    id: 100,
                    title: "Article 1",
                    link: "https://example.com/1",
                    description: "desc",
                    published_at: "2024-01-01",
                    user_subscription_id: 1,
                    user_id: "u1",
                    created_at: "2024-01-01",
                    updated_at: "2024-01-01",
                },
                {
                    id: 200,
                    title: "Article 2",
                    link: "https://example.com/2",
                    description: "desc2",
                    published_at: "2024-01-02",
                    user_subscription_id: 1,
                    user_id: "u1",
                    created_at: "2024-01-02",
                    updated_at: "2024-01-02",
                },
            ];

            feedItemRepo.findBySubscriptionIdPaginated.mockResolvedValue({
                data: mockItems,
                total: 2,
                page: 1,
                limit: 10,
            } as any);

            favoriteRepo.findFavoritesByFeedItemIds.mockResolvedValue([
                { id: 1, user_id: "u1", feed_item_id: 100 },
            ] as any);

            const tagsMap = new Map<number, string[]>();
            tagsMap.set(100, ["Tech", "News"]);
            tagsMap.set(200, []);
            tagRepo.findTagsMapByFeedItemIds.mockResolvedValue(tagsMap);

            const result = await service.getFeedItemsPaginated("u1", 1, 1, 10);

            expect(result.total).toBe(2);
            expect(result.data).toHaveLength(2);

            // First item is favorited and tagged
            expect(result.data[0].isFavorite).toBe(true);
            expect(result.data[0].tags).toEqual(["Tech", "News"]);

            // Second item is not favorited and has no tags
            expect(result.data[1].isFavorite).toBe(false);
            expect(result.data[1].tags).toEqual([]);

            // Verify batch queries were called with correct IDs
            expect(
                favoriteRepo.findFavoritesByFeedItemIds,
            ).toHaveBeenCalledWith("u1", [100, 200]);
            expect(tagRepo.findTagsMapByFeedItemIds).toHaveBeenCalledWith(
                "u1",
                [100, 200],
            );
        });
    });

    describe("insertFeedItem", () => {
        it("maps parameters to repository insert format", async () => {
            const mockInserted = { id: 1, title: "New Article" };
            feedItemRepo.insertFeedItem.mockResolvedValue(mockInserted as any);

            const pubDate = new Date("2024-06-01");
            const result = await service.insertFeedItem(
                5,
                "u1",
                "New Article",
                "https://example.com/new",
                "A description",
                pubDate,
            );

            expect(result).toEqual(mockInserted);
            expect(feedItemRepo.insertFeedItem).toHaveBeenCalledWith({
                user_subscription_id: 5,
                user_id: "u1",
                title: "New Article",
                link: "https://example.com/new",
                description: "A description",
                published_at: pubDate,
            });
        });

        it("handles null publishedAt", async () => {
            feedItemRepo.insertFeedItem.mockResolvedValue({ id: 2 } as any);

            await service.insertFeedItem(
                5,
                "u1",
                "No Date",
                "https://example.com/nodate",
                "desc",
                null,
            );

            expect(feedItemRepo.insertFeedItem).toHaveBeenCalledWith(
                expect.objectContaining({ published_at: null }),
            );
        });
    });
});
