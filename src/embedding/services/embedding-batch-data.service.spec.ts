import { jest } from "@test-utils/jest-globals";
import { EmbeddingBatchDataService } from "@/embedding/services/embedding-batch-data.service";
import type { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { Database } from "@/types/schema";

type SupabaseClientStub = {
    rpc: jest.Mock;
    from: jest.Mock;
};

const createQueryChain = <T>(result: T) => {
    const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue(result),
    };
    return chain;
};

const createThenableChain = <T>(result: T) => {
    const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        // biome-ignore lint/suspicious/noThenProperty: Supabase client is thenable; we mirror that shape for await.
        then: (resolve: (value: T) => void) => Promise.resolve(resolve(result)),
    };
    return chain;
};

describe("EmbeddingBatchDataService", () => {
    let service: EmbeddingBatchDataService;
    let client: SupabaseClientStub;

    beforeEach(() => {
        client = {
            rpc: jest.fn(),
            from: jest.fn(),
        };
        const admin = {
            getClient: jest.fn().mockReturnValue(client),
        } as unknown as { getClient: () => SupabaseClientStub };
        service = new EmbeddingBatchDataService(
            admin as unknown as SupabaseAdminService,
        );
    });

    it("returns a single feed item with combined text", async () => {
        const row: Pick<
            Database["public"]["Tables"]["feed_items"]["Row"],
            "id" | "title" | "description"
        > = {
            id: 1,
            title: "Title",
            description: "Desc",
        };
        client.from.mockReturnValue(
            createQueryChain({ data: row, error: null }),
        );

        const result = await service.getSingleItem("u1", "feed_items", 1);

        expect(result).toEqual({ id: 1, contentText: "Title Desc" });
    });

    it("returns a single daily summary using markdown or title", async () => {
        const row: Pick<
            Database["public"]["Tables"]["daily_summaries"]["Row"],
            "id" | "markdown" | "summary_title"
        > = {
            id: 2,
            markdown: "",
            summary_title: "Summary",
        };
        client.from.mockReturnValue(
            createQueryChain({ data: row, error: null }),
        );

        const result = await service.getSingleItem("u1", "daily_summaries", 2);

        expect(result).toEqual({ id: 2, contentText: "Summary" });
    });

    it("returns a single podcast episode title", async () => {
        const row: Pick<
            Database["public"]["Tables"]["podcast_episodes"]["Row"],
            "id" | "title"
        > = {
            id: 3,
            title: "Episode",
        };
        client.from.mockReturnValue(
            createQueryChain({ data: row, error: null }),
        );

        const result = await service.getSingleItem("u1", "podcast_episodes", 3);

        expect(result).toEqual({ id: 3, contentText: "Episode" });
    });

    it("returns a single tag with description", async () => {
        const row: Pick<
            Database["public"]["Tables"]["tags"]["Row"],
            "id" | "tag_name" | "description"
        > = {
            id: 4,
            tag_name: "Tag",
            description: "Note",
        };
        client.from.mockReturnValue(
            createQueryChain({ data: row, error: null }),
        );

        const result = await service.getSingleItem("u1", "tags", 4);

        expect(result).toEqual({ id: 4, contentText: "Tag Note" });
    });

    it("returns null when record is missing", async () => {
        client.from.mockReturnValue(
            createQueryChain({ data: null, error: null }),
        );

        const result = await service.getSingleItem("u1", "tags", 999);

        expect(result).toBeNull();
    });

    it("throws when single item query returns error", async () => {
        client.from.mockReturnValue(
            createQueryChain({ data: null, error: { message: "boom" } }),
        );

        await expect(
            service.getSingleItem("u1", "tags", 1),
        ).rejects.toBeDefined();
    });

    it("returns missing embeddings count", async () => {
        client.from.mockReturnValue(
            createThenableChain({ count: 5, error: null }),
        );

        const count = await service.getMissingEmbeddingsCount("u1", "tags");

        expect(count).toBe(5);
    });

    it("throws when table type is invalid for getSingleItem", async () => {
        await expect(
            service.getSingleItem("u1", "invalid" as never, 1),
        ).rejects.toBeDefined();
    });

    it("fetches batch data via rpc", async () => {
        client.rpc.mockResolvedValue({
            data: [{ id: 1, title: "A", description: "B" }],
            error: null,
        });

        const result = await service.getBatchData("u1", "feed_items", 10);

        expect(result).toEqual([
            { id: 1, title: "A", description: "B", contentText: "A B" },
        ]);
    });
});
