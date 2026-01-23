import { Injectable, Logger } from "@nestjs/common";
import { getErrorMessage } from "@/common/utils/error-message";
import {
    EmbeddingBatchException,
    InvalidTableTypeException,
} from "@/embedding/exceptions/embedding-batch.exceptions";
import type { IBatchDataService } from "@/embedding/interfaces/batch-data.interface";
import type {
    BatchItem,
    FeedItemBatch,
    PodcastBatch,
    SummaryBatch,
    TableType,
    TagBatch,
} from "@/embedding/types/embedding-batch.types";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { Database } from "@/types/schema";

type BatchRpcName =
    | "fn_list_missing_feed_item_embeddings"
    | "fn_list_missing_summary_embeddings"
    | "fn_list_missing_podcast_embeddings"
    | "fn_list_missing_tag_embeddings";

type BatchRpcArgs =
    Database["public"]["Functions"]["fn_list_missing_feed_item_embeddings"]["Args"];

type FeedItemEmbeddingRow =
    Database["public"]["Functions"]["fn_list_missing_feed_item_embeddings"]["Returns"][number];
type SummaryEmbeddingRow =
    Database["public"]["Functions"]["fn_list_missing_summary_embeddings"]["Returns"][number];
type PodcastEmbeddingRow =
    Database["public"]["Functions"]["fn_list_missing_podcast_embeddings"]["Returns"][number];
type TagEmbeddingRow =
    Database["public"]["Functions"]["fn_list_missing_tag_embeddings"]["Returns"][number];

type FeedItemRow = Pick<
    Database["public"]["Tables"]["feed_items"]["Row"],
    "id" | "title" | "description"
>;
type SummaryRow = Pick<
    Database["public"]["Tables"]["daily_summaries"]["Row"],
    "id" | "markdown" | "summary_title"
>;
type PodcastRow = Pick<
    Database["public"]["Tables"]["podcast_episodes"]["Row"],
    "id" | "title"
>;
type TagRow = Pick<
    Database["public"]["Tables"]["tags"]["Row"],
    "id" | "tag_name" | "description"
>;

const EMBEDDING_COLUMN_BY_TABLE = {
    feed_items: "title_emb",
    daily_summaries: "summary_emb",
    podcast_episodes: "title_emb",
    tags: "tag_emb",
} as const satisfies Record<TableType, string>;

@Injectable()
export class EmbeddingBatchDataService implements IBatchDataService {
    private readonly logger = new Logger(EmbeddingBatchDataService.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    getFeedItemsBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<FeedItemBatch[]> {
        return this.fetchBatch<FeedItemEmbeddingRow, FeedItemBatch>(
            userId,
            "fn_list_missing_feed_item_embeddings",
            this.buildBatchParams(userId, batchSize, lastId),
            (item) => ({
                id: item.id,
                title: item.title,
                description: item.description,
                contentText: this.buildContentText(
                    item.title,
                    item.description,
                ),
            }),
            "feed items",
        );
    }

    getDailySummariesBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<SummaryBatch[]> {
        return this.fetchBatch<SummaryEmbeddingRow, SummaryBatch>(
            userId,
            "fn_list_missing_summary_embeddings",
            this.buildBatchParams(userId, batchSize, lastId),
            (item) => ({
                id: item.id,
                summaryTitle: item.summary_title,
                markdown: item.markdown,
                contentText: this.pickFirstNonEmpty(
                    item.markdown,
                    item.summary_title,
                ),
            }),
            "summaries",
        );
    }

    getPodcastEpisodesBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<PodcastBatch[]> {
        return this.fetchBatch<PodcastEmbeddingRow, PodcastBatch>(
            userId,
            "fn_list_missing_podcast_embeddings",
            this.buildBatchParams(userId, batchSize, lastId),
            (item) => ({
                id: item.id,
                title: item.title,
                contentText: this.buildContentText(item.title),
            }),
            "podcast episodes",
        );
    }

    getTagsBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<TagBatch[]> {
        return this.fetchBatch<TagEmbeddingRow, TagBatch>(
            userId,
            "fn_list_missing_tag_embeddings",
            this.buildBatchParams(userId, batchSize, lastId),
            (item) => ({
                id: item.id,
                tagName: item.tag_name,
                description: item.description,
                contentText: this.buildContentText(
                    item.tag_name,
                    item.description,
                ),
            }),
            "tags",
        );
    }

    async getMissingEmbeddingsCount(
        userId: string,
        tableType: TableType,
    ): Promise<number> {
        try {
            const sb = this.admin.getClient();
            const embeddingColumn = this.getEmbeddingColumn(tableType);
            const { count, error } = await sb
                .from(tableType)
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .is(embeddingColumn, null)
                .eq("soft_deleted", false);

            if (error) {
                throw new Error(error.message);
            }

            return count || 0;
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            this.logger.error(
                `Failed to get missing embeddings count: ${message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to get missing embeddings count: ${message}`,
                userId,
            );
        }
    }

    getBatchData(
        userId: string,
        tableType: TableType,
        batchSize: number,
        lastId?: number,
    ): Promise<BatchItem[]> {
        switch (tableType) {
            case "feed_items":
                return this.getFeedItemsBatch(userId, batchSize, lastId);
            case "daily_summaries":
                return this.getDailySummariesBatch(userId, batchSize, lastId);
            case "podcast_episodes":
                return this.getPodcastEpisodesBatch(userId, batchSize, lastId);
            case "tags":
                return this.getTagsBatch(userId, batchSize, lastId);
            default:
                throw new InvalidTableTypeException(tableType);
        }
    }

    getSingleItem(
        userId: string,
        tableType: TableType,
        recordId: number,
    ): Promise<BatchItem | null> {
        switch (tableType) {
            case "feed_items":
                return this.getSingleFeedItem(userId, recordId);
            case "daily_summaries":
                return this.getSingleDailySummary(userId, recordId);
            case "podcast_episodes":
                return this.getSinglePodcastEpisode(userId, recordId);
            case "tags":
                return this.getSingleTag(userId, recordId);
            default:
                throw new InvalidTableTypeException(tableType);
        }
    }

    private buildBatchParams(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): BatchRpcArgs {
        return {
            p_user_id: userId,
            p_limit: batchSize,
            p_last_id: lastId,
        };
    }

    private buildContentText(
        ...parts: Array<string | null | undefined>
    ): string {
        return parts
            .map((part) => (typeof part === "string" ? part.trim() : ""))
            .filter((part) => part.length > 0)
            .join(" ");
    }

    private pickFirstNonEmpty(
        ...parts: Array<string | null | undefined>
    ): string {
        for (const part of parts) {
            const trimmed = typeof part === "string" ? part.trim() : "";
            if (trimmed.length > 0) {
                return trimmed;
            }
        }
        return "";
    }

    private async fetchBatch<TIn, TOut>(
        userId: string,
        rpcName: BatchRpcName,
        params: BatchRpcArgs,
        mapItem: (item: TIn) => TOut,
        contextLabel: string,
    ): Promise<TOut[]> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc(rpcName, params);

            if (error) {
                throw new Error(error.message);
            }

            return (data ?? []).map((item) => mapItem(item as TIn));
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            this.logger.error(
                `Failed to fetch ${contextLabel} batch: ${message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to fetch ${contextLabel} batch: ${message}`,
                userId,
            );
        }
    }

    private async fetchSingleRow<Row>(
        userId: string,
        recordId: number,
        table: TableType,
        select: string,
        contextLabel: string,
    ): Promise<Row | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb
                .from(table)
                .select(select)
                .eq("id", recordId)
                .eq("user_id", userId)
                .eq("soft_deleted", false)
                .maybeSingle();

            if (error) {
                throw new Error(error.message);
            }

            return data ? (data as Row) : null;
        } catch (error: unknown) {
            this.logger.error(
                `Failed to fetch ${contextLabel} ${recordId}: ${getErrorMessage(
                    error,
                )}`,
            );
            throw error;
        }
    }

    private getEmbeddingColumn(tableType: TableType): string {
        return EMBEDDING_COLUMN_BY_TABLE[tableType];
    }

    private async getSingleFeedItem(
        userId: string,
        recordId: number,
    ): Promise<BatchItem | null> {
        const row = await this.fetchSingleRow<FeedItemRow>(
            userId,
            recordId,
            "feed_items",
            "id,title,description",
            "feed item",
        );
        if (!row) return null;

        return {
            id: row.id,
            contentText: this.buildContentText(row.title, row.description),
        };
    }

    private async getSingleDailySummary(
        userId: string,
        recordId: number,
    ): Promise<BatchItem | null> {
        const row = await this.fetchSingleRow<SummaryRow>(
            userId,
            recordId,
            "daily_summaries",
            "id,markdown,summary_title",
            "daily summary",
        );
        if (!row) return null;

        return {
            id: row.id,
            contentText: this.pickFirstNonEmpty(
                row.markdown,
                row.summary_title,
            ),
        };
    }

    private async getSinglePodcastEpisode(
        userId: string,
        recordId: number,
    ): Promise<BatchItem | null> {
        const row = await this.fetchSingleRow<PodcastRow>(
            userId,
            recordId,
            "podcast_episodes",
            "id,title",
            "podcast episode",
        );
        if (!row) return null;

        return {
            id: row.id,
            contentText: this.buildContentText(row.title),
        };
    }

    private async getSingleTag(
        userId: string,
        recordId: number,
    ): Promise<BatchItem | null> {
        const row = await this.fetchSingleRow<TagRow>(
            userId,
            recordId,
            "tags",
            "id,tag_name,description",
            "tag",
        );
        if (!row) return null;

        return {
            id: row.id,
            contentText: this.buildContentText(row.tag_name, row.description),
        };
    }
}
