import { FavoriteRepository } from "@/favorite/infrastructure/favorite.repository";
import { FavoriteService } from "@/favorite/application/favorite.service";

describe("FavoriteService", () => {
    let service: FavoriteService;
    let favRepo: jest.Mocked<FavoriteRepository>;

    beforeEach(() => {
        favRepo = {
            findAllByUserId: jest.fn(),
            addFavorite: jest.fn(),
            removeFavorite: jest.fn(),
            isFavorited: jest.fn(),
            findFavoritesByFeedItemIds: jest.fn(),
        } as unknown as jest.Mocked<FavoriteRepository>;

        service = new FavoriteService(favRepo);
    });

    describe("getUserFavorites", () => {
        it("returns favorites from repository", async () => {
            const mockFavorites = [
                { id: 1, user_id: "u1", feed_item_id: 10 },
                { id: 2, user_id: "u1", feed_item_id: 20 },
            ];
            favRepo.findAllByUserId.mockResolvedValue(mockFavorites as any);

            const result = await service.getUserFavorites("u1");

            expect(result).toEqual(mockFavorites);
            expect(favRepo.findAllByUserId).toHaveBeenCalledWith("u1");
        });

        it("returns empty array when no favorites", async () => {
            favRepo.findAllByUserId.mockResolvedValue([]);
            const result = await service.getUserFavorites("u1");
            expect(result).toEqual([]);
        });
    });

    describe("favoriteFeedItem", () => {
        it("delegates to repository addFavorite", async () => {
            const mockRow = { id: 1, user_id: "u1", feed_item_id: 42 };
            favRepo.addFavorite.mockResolvedValue(mockRow as any);

            const result = await service.favoriteFeedItem("u1", 42);

            expect(result).toEqual(mockRow);
            expect(favRepo.addFavorite).toHaveBeenCalledWith("u1", 42);
        });
    });

    describe("unfavoriteFeedItem", () => {
        it("delegates to repository removeFavorite", async () => {
            favRepo.removeFavorite.mockResolvedValue(undefined);

            await service.unfavoriteFeedItem("u1", 42);

            expect(favRepo.removeFavorite).toHaveBeenCalledWith("u1", 42);
        });
    });

    describe("isFavorited", () => {
        it("returns true when favorited", async () => {
            favRepo.isFavorited.mockResolvedValue(true);
            const result = await service.isFavorited("u1", 10);
            expect(result).toBe(true);
            expect(favRepo.isFavorited).toHaveBeenCalledWith("u1", 10);
        });

        it("returns false when not favorited", async () => {
            favRepo.isFavorited.mockResolvedValue(false);
            const result = await service.isFavorited("u1", 99);
            expect(result).toBe(false);
        });
    });
});
