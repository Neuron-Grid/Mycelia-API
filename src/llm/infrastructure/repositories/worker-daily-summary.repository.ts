import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
    DailySummaryEntity,
    DailySummaryItemEntity,
} from "@/llm/domain/entities/daily-summary.entity";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { Database, TablesUpdate } from "@/types/schema";

// RPC戻り値の型定義
type DailySummaryRow =
    Database["public"]["Functions"]["fn_find_daily_summary_by_date"]["Returns"][number];
type FnFindDailySummaryByIdRow =
    Database["public"]["Functions"]["fn_find_daily_summary_by_id"]["Returns"][number];
type FnUpsertDailySummaryRow =
    Database["public"]["Functions"]["fn_upsert_daily_summary"]["Returns"];
type FnUpdateDailySummaryRow =
    Database["public"]["Functions"]["fn_update_daily_summary"]["Returns"];
type FnGetSummaryItemsRow =
    Database["public"]["Functions"]["fn_get_summary_items"]["Returns"][number];

@Injectable()
export class WorkerDailySummaryRepository {
    private readonly logger = new Logger(WorkerDailySummaryRepository.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    /**
     * 日付によるサマリー検索（RPC経由）
     * A+ Architecture: 直接テーブル操作を禁止し、RPC経由でアクセス
     */
    async findByUserAndDate(
        userId: string,
        summaryDate: string,
    ): Promise<DailySummaryEntity | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc(
                "fn_find_daily_summary_by_date",
                { p_user_id: userId, p_summary_date: summaryDate },
            );
            if (error) throw error;
            const rows = data ?? [];
            if (rows.length === 0) return null;
            return new DailySummaryEntity(rows[0] as DailySummaryRow);
        } catch (e) {
            this.logger.error(`findByUserAndDate: ${(e as Error).message}`);
            return null;
        }
    }

    /**
     * サマリーの作成（UPSERT）
     * A+ Architecture: 既にRPC経由で実装済み
     */
    async create(
        userId: string,
        summaryDate: string,
        data: {
            markdown?: string;
            summary_title?: string;
            summary_emb?: number[];
        },
    ): Promise<DailySummaryEntity> {
        const sb = this.admin.getClient();
        const { data: row, error } = await sb.rpc("fn_upsert_daily_summary", {
            p_user_id: userId,
            p_summary_date: summaryDate,
            p_summary_title: data.summary_title ?? "",
            p_markdown: data.markdown ?? "",
            // RPC型が number[] を要求するため、未指定時は null を明示的にキャスト
            p_summary_emb: (data.summary_emb ?? null) as unknown as number[],
        });
        if (error) throw error as Error;
        return new DailySummaryEntity(row as FnUpsertDailySummaryRow);
    }

    /**
     * サマリーの更新（RPC経由）
     * A+ Architecture: 直接テーブル操作を禁止し、RPC経由でアクセス
     */
    async update(
        id: number,
        userId: string,
        data: TablesUpdate<"daily_summaries">,
    ): Promise<DailySummaryEntity> {
        const sb = this.admin.getClient();
        const { data: result, error } = await sb.rpc(
            "fn_update_daily_summary",
            {
                p_user_id: userId,
                p_id: id,
                p_summary_title: data.summary_title ?? undefined,
                p_markdown: data.markdown ?? undefined,
                p_summary_emb: data.summary_emb ?? undefined,
                p_script_tts_duration_sec:
                    data.script_tts_duration_sec ?? undefined,
            },
        );
        if (error) throw error as Error;
        if (!result) throw new NotFoundException();
        return new DailySummaryEntity(result as FnUpdateDailySummaryRow);
    }

    /**
     * サマリーアイテムの追加
     * A+ Architecture: 既にRPC経由で実装済み
     */
    async addSummaryItems(
        summaryId: number,
        userId: string,
        feedItemIds: number[],
    ): Promise<void> {
        const sb = this.admin.getClient();
        const { error } = await sb.rpc("fn_add_summary_items", {
            p_user_id: userId,
            p_summary_id: summaryId,
            p_feed_item_ids: feedItemIds,
        });
        if (error) throw error as Error;
    }

    // サマリーアイテムの取得（RPC経由）
    async getSummaryItems(
        summaryId: number,
        userId: string,
    ): Promise<DailySummaryItemEntity[]> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc("fn_get_summary_items", {
                p_user_id: userId,
                p_summary_id: summaryId,
            });
            if (error) throw error;
            const rows = (data ?? []) as FnGetSummaryItemsRow[];
            return rows.map((d) => new DailySummaryItemEntity(d));
        } catch (e) {
            this.logger.error(`getSummaryItems: ${(e as Error).message}`);
            return [];
        }
    }

    /**
     * IDによるサマリー検索（RPC経由）
     * A+ Architecture: 直接テーブル操作を禁止し、RPC経由でアクセス
     */
    async findById(
        id: number,
        userId: string,
    ): Promise<DailySummaryEntity | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc(
                "fn_find_daily_summary_by_id",
                {
                    p_user_id: userId,
                    p_id: id,
                },
            );
            if (error) throw error;
            const rows = data ?? [];
            if (rows.length === 0) return null;
            return new DailySummaryEntity(rows[0] as FnFindDailySummaryByIdRow);
        } catch (e) {
            this.logger.error(`findById: ${(e as Error).message}`);
            return null;
        }
    }

    /**
     * 最近のフィードアイテム取得
     * A+ Architecture: 既にRPC経由で実装済み
     */
    async getRecentFeedItems(
        userId: string,
        hoursBack = 24,
    ): Promise<
        {
            id: number;
            title: string;
            description: string | null;
            link: string;
            published_at: string | null;
        }[]
    > {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - hoursBack);
        const sb = this.admin.getClient();
        const { data, error } = await sb.rpc("fn_list_recent_feed_items", {
            p_user_id: userId,
            p_since: cutoff.toISOString(),
            p_limit: 200,
        });
        if (error) {
            this.logger.error(`fn_list_recent_feed_items: ${error.message}`);
            return [];
        }
        const rows = (data ||
            []) as Database["public"]["Functions"]["fn_list_recent_feed_items"]["Returns"];
        return rows.map((d) => ({
            id: d.id,
            title: d.title,
            description: d.description,
            link: d.link,
            published_at: d.published_at,
        }));
    }
}
