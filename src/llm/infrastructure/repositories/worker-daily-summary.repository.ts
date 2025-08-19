import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
    DailySummaryEntity,
    DailySummaryItemEntity,
} from "@/llm/domain/entities/daily-summary.entity";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { Database, TablesUpdate } from "@/types/schema";

@Injectable()
export class WorkerDailySummaryRepository {
    private readonly logger = new Logger(WorkerDailySummaryRepository.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    async findByUserAndDate(
        userId: string,
        summaryDate: string,
    ): Promise<DailySummaryEntity | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb
                .from("daily_summaries")
                .select("*")
                .eq("user_id", userId)
                .eq("summary_date", summaryDate)
                .eq("soft_deleted", false)
                .single();
            if (error) {
                const code = (error as { code?: string }).code;
                if (code === "PGRST116") return null;
                throw error;
            }
            return new DailySummaryEntity(
                data as Database["public"]["Tables"]["daily_summaries"]["Row"],
            );
        } catch (e) {
            this.logger.error(`findByUserAndDate: ${(e as Error).message}`);
            return null;
        }
    }

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
        return new DailySummaryEntity(
            row as Database["public"]["Tables"]["daily_summaries"]["Row"],
        );
    }

    async update(
        id: number,
        userId: string,
        data: TablesUpdate<"daily_summaries">,
    ): Promise<DailySummaryEntity> {
        const sb = this.admin.getClient();
        const { data: result, error } = await sb
            .from("daily_summaries")
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("user_id", userId)
            .eq("soft_deleted", false)
            .select()
            .single();
        if (error) throw error as Error;
        if (!result) throw new NotFoundException();
        return new DailySummaryEntity(
            result as Database["public"]["Tables"]["daily_summaries"]["Row"],
        );
    }

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

    async getSummaryItems(
        summaryId: number,
        userId: string,
    ): Promise<DailySummaryItemEntity[]> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb
                .from("daily_summary_items")
                .select("*")
                .eq("summary_id", summaryId)
                .eq("user_id", userId);
            if (error) throw error;
            return (data || []).map((d) => new DailySummaryItemEntity(d));
        } catch (e) {
            this.logger.error(`getSummaryItems: ${(e as Error).message}`);
            return [];
        }
    }

    async findById(
        id: number,
        userId: string,
    ): Promise<DailySummaryEntity | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb
                .from("daily_summaries")
                .select("*")
                .eq("id", id)
                .eq("user_id", userId)
                .eq("soft_deleted", false)
                .single();
            if (error) {
                const code = (error as { code?: string }).code;
                if (code === "PGRST116") return null;
                throw error;
            }
            return new DailySummaryEntity(
                data as Database["public"]["Tables"]["daily_summaries"]["Row"],
            );
        } catch (e) {
            this.logger.error(`findById: ${(e as Error).message}`);
            return null;
        }
    }

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
