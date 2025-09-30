import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DailySummaryRepository } from "@/llm/infrastructure/repositories/daily-summary.repository";
import type { SupabaseRequestService } from "@/supabase-request.service";

describe("DailySummaryRepository", () => {
    const selectMock = jest.fn();
    const eqMock = jest.fn();
    const orMock = jest.fn();
    const orderMock = jest.fn();

    const chain: Record<string, unknown> = {
        select: selectMock,
        eq: eqMock,
        or: orMock,
        order: orderMock,
    };

    const fromMock = jest.fn(() => chain);
    const getClientMock = jest.fn(() => ({ from: fromMock }));
    const supabaseService = {
        getClient: getClientMock,
    } as unknown as SupabaseRequestService;

    const repository = new DailySummaryRepository(supabaseService);

    beforeEach(() => {
        selectMock.mockReturnValue(chain);
        eqMock.mockReturnValue(chain);
        orMock.mockReturnValue(chain);
        orderMock.mockReset();
        fromMock.mockClear();
        getClientMock.mockClear();
    });

    it("falls back to createdAt when publishedAt is null", async () => {
        const createdAt = "2024-02-01T00:00:00.000Z";
        const data = [
            {
                id: 1,
                title: "title",
                link: "https://example.com",
                description: "desc",
                published_at: null,
                created_at: createdAt,
                user_subscriptions: { feed_title: "Feed" },
            },
        ];

        orderMock
            .mockReturnValueOnce(chain)
            .mockResolvedValueOnce({ data, error: null });

        const result = await repository.getRecentFeedItems("user-1", 24);

        expect(result).toHaveLength(1);
        expect(result[0].published_at).toBe(createdAt);
        expect(orMock).toHaveBeenCalledWith(
            expect.stringContaining("published_at.is.null"),
        );
        expect(orderMock).toHaveBeenNthCalledWith(1, "published_at", {
            ascending: false,
            nullsFirst: false,
        });
        expect(orderMock).toHaveBeenNthCalledWith(2, "created_at", {
            ascending: false,
        });
    });
});
