import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { WorkerFeedItemRepository } from "@/feed/infrastructure/worker-feed-item.repository";
import type { SupabaseAdminService } from "@/shared/supabase-admin.service";

describe("WorkerFeedItemRepository", () => {
    const rpcMock = jest.fn();
    const getClientMock = jest.fn(() => ({ rpc: rpcMock }));
    const adminService = {
        getClient: getClientMock,
    } as unknown as SupabaseAdminService;
    const repository = new WorkerFeedItemRepository(adminService);

    beforeEach(() => {
        rpcMock.mockReset();
        getClientMock.mockClear();
    });

    it("passes null when publishedAt is null", async () => {
        rpcMock.mockResolvedValue({
            data: [{ id: 1, inserted: true }],
            error: null,
        });

        await repository.insertFeedItem(
            1,
            "user-1",
            "title",
            "https://example.com",
            "desc",
            null,
            null,
        );

        expect(rpcMock).toHaveBeenCalledWith(
            "fn_insert_feed_item",
            expect.objectContaining({ p_published_at: null }),
        );
    });

    it("serializes publishedAt when provided", async () => {
        rpcMock.mockResolvedValue({
            data: [{ id: 1, inserted: true }],
            error: null,
        });
        const publishedAt = new Date("2024-01-01T00:00:00.000Z");

        await repository.insertFeedItem(
            1,
            "user-1",
            "title",
            "https://example.com",
            "desc",
            publishedAt,
            "https://example.com/canonical",
        );

        expect(rpcMock).toHaveBeenCalledWith(
            "fn_insert_feed_item",
            expect.objectContaining({
                p_published_at: publishedAt.toISOString(),
                p_canonical_url: "https://example.com/canonical",
            }),
        );
    });
});
