import { EmbeddingBatchDataService } from "@/embedding/services/embedding-batch-data.service";
import type { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { Database } from "@/types/schema";

type SupabaseClientStub = {
    rpc: jest.Mock;
};

describe("EmbeddingBatchDataService", () => {
    let service: EmbeddingBatchDataService;
    let client: SupabaseClientStub;

    beforeEach(() => {
        client = {
            rpc: jest.fn(),
        };
        const admin = {
            getClient: jest.fn().mockReturnValue(client),
        } as unknown as { getClient: () => SupabaseClientStub };
        service = new EmbeddingBatchDataService(
            admin as unknown as SupabaseAdminService,
        );
    });

    it("returns a single feed item with combined text", async () => {
        const row: Database["public"]["Functions"][
            "fn_list_missing_feed_item_embeddings"
        ]["Returns"][number] = {
            id: 1,
            title: "Title",
            description: "Desc",
        };
        client.rpc.mockResolvedValue({ data: [row], error: null });

        const result = await service.getSingleItem("u1", "feed_items", 1);

        expect(result).toEqual({ id: 1, contentText: "Title Desc" });
    });

    it("returns a single daily summary using markdown or title", async () => {
        const row = {
            id: 2,
            markdown: "",
            summary_title: "Summary",
        } as Database["public"]["Functions"]["fn_find_daily_summary_by_id"][
            "Returns"
        ][number];
        client.rpc.mockResolvedValue({ data: [row], error: null });

        const result = await service.getSingleItem("u1", "daily_summaries", 2);

        expect(result).toEqual({ id: 2, contentText: "Summary" });
    });

    it("returns a single podcast episode title", async () => {
        const row = {
            id: 3,
            title: "Episode",
        } as Database["public"]["Functions"]["fn_find_podcast_by_id"][
            "Returns"
        ][number];
        client.rpc.mockResolvedValue({ data: [row], error: null });

        const result = await service.getSingleItem("u1", "podcast_episodes", 3);

        expect(result).toEqual({ id: 3, contentText: "Episode" });
    });

    it("returns a single tag with description", async () => {
        const row:
            Database["public"]["Functions"]["fn_list_missing_tag_embeddings"][
                "Returns"
            ][number] = {
                id: 4,
                tag_name: "Tag",
                description: "Note",
            };
        client.rpc.mockResolvedValue({ data: [row], error: null });

        const result = await service.getSingleItem("u1", "tags", 4);

        expect(result).toEqual({ id: 4, contentText: "Tag Note" });
    });

    it("returns null when record is missing", async () => {
        client.rpc.mockResolvedValue({ data: [], error: null });

        const result = await service.getSingleItem("u1", "tags", 999);

        expect(result).toBeNull();
    });

    it("throws when single item query returns error", async () => {
        client.rpc.mockResolvedValue({
            data: null,
            error: { message: "boom" },
        });

        await expect(
            service.getSingleItem("u1", "tags", 1),
        ).rejects.toBeDefined();
    });

    it("returns missing embeddings count", async () => {
        client.rpc
            .mockResolvedValueOnce({
                data: [{ id: 1 }, { id: 2 }],
                error: null,
            })
            .mockResolvedValueOnce({ data: [], error: null });

        const count = await service.getMissingEmbeddingsCount("u1", "tags");

        expect(count).toBe(2);
    });

    it("throws when table type is invalid for getSingleItem", () => {
        expect(() => service.getSingleItem("u1", "invalid" as never, 1))
            .toThrow();
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
