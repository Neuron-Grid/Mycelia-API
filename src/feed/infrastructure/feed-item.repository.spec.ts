import { describe, expect, it, jest } from "@jest/globals";
import { FeedItemRepository } from "@/feed/infrastructure/feed-item.repository";
import type { SupabaseRequestService } from "@/supabase-request.service";

describe("FeedItemRepository", () => {
    it("does not send link_hash to Supabase so the trigger can populate it", async () => {
        const insertMock = jest.fn().mockResolvedValue({ error: null });
        const fromMock = jest.fn().mockReturnValue({ insert: insertMock });
        const clientMock = { from: fromMock };
        const supabaseServiceMock = {
            getClient: () => clientMock,
        } as unknown as SupabaseRequestService;
        const repository = new FeedItemRepository(supabaseServiceMock);

        const publishedAt = new Date("2024-01-01T00:00:00.000Z");
        await repository.insertFeedItem({
            user_subscription_id: 1,
            user_id: "00000000-0000-0000-0000-000000000000",
            title: "Example",
            link: "https://example.com/article",
            description: "Desc",
            published_at: publishedAt,
        });

        expect(fromMock).toHaveBeenCalledWith("feed_items");
        expect(insertMock).toHaveBeenCalledTimes(1);
        const payload = insertMock.mock.calls[0][0];
        expect(payload).not.toHaveProperty("link_hash");
        expect(payload.published_at).toBe(publishedAt.toISOString());
    });
});
