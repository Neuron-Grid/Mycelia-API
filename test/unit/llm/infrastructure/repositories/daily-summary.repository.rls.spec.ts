import {
    createSupabaseServiceMock,
    createSupabaseTableChain,
} from "@test-utils/supabase-mock";
import { DailySummaryRepository } from "@/llm/infrastructure/repositories/daily-summary.repository";

describe("DailySummaryRepository RLS enforcement", () => {
    it("filters by user and date when finding summaries", async () => {
        const supabaseMock = createSupabaseServiceMock();
        const dailyChain = createSupabaseTableChain();
        supabaseMock.tableChains.set("daily_summaries", dailyChain);
        const nowIso = new Date().toISOString();
        dailyChain.single.mockResolvedValue({
            data: {
                id: 1,
                user_id: "user-1",
                summary_date: "2025-10-17",
                markdown: "",
                summary_title: "",
                soft_deleted: false,
                created_at: nowIso,
                updated_at: nowIso,
            },
            error: null,
        });

        const repository = new DailySummaryRepository(
            supabaseMock.supabaseService,
        );
        const result = await repository.findByUserAndDate(
            "user-1",
            "2025-10-17",
        );

        expect(supabaseMock.fromMock).toHaveBeenCalledWith("daily_summaries");
        const eqArgsForFind = dailyChain.eq.mock.calls.map(
            ([column, value]: [string, unknown]) => [column, value],
        );
        expect(eqArgsForFind).toEqual(
            expect.arrayContaining([
                ["user_id", "user-1"],
                ["summary_date", "2025-10-17"],
                ["soft_deleted", false],
            ]),
        );
        expect(eqArgsForFind).toHaveLength(3);
        expect(result).not.toBeNull();
    });

    it("guards update operations with user_id filter", async () => {
        const supabaseMock = createSupabaseServiceMock();
        const dailyChain = createSupabaseTableChain();
        supabaseMock.tableChains.set("daily_summaries", dailyChain);
        const nowIso = new Date().toISOString();
        dailyChain.single.mockResolvedValue({
            data: {
                id: 1,
                user_id: "user-1",
                summary_date: "2025-10-17",
                markdown: "updated",
                summary_title: "",
                soft_deleted: false,
                created_at: nowIso,
                updated_at: nowIso,
            },
            error: null,
        });

        const repository = new DailySummaryRepository(
            supabaseMock.supabaseService,
        );
        await repository.update(1, "user-1", { markdown: "updated" });

        expect(dailyChain.update).toHaveBeenCalledWith(
            expect.objectContaining({ markdown: "updated" }),
        );
        const eqArgsForUpdate = dailyChain.eq.mock.calls.map(
            ([column, value]: [string, unknown]) => [column, value],
        );
        expect(eqArgsForUpdate).toEqual(
            expect.arrayContaining([
                ["id", 1],
                ["user_id", "user-1"],
                ["soft_deleted", false],
            ]),
        );
        expect(eqArgsForUpdate).toHaveLength(3);
        expect(dailyChain.select).toHaveBeenCalled();
    });
});
