import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import {
    EmbeddingBatchException,
    InvalidTableTypeException,
} from "../exceptions/embedding-batch.exceptions";
import { IBatchDataService } from "../interfaces/batch-data.interface";
import {
    BatchItem,
    FeedItemBatch,
    PodcastBatch,
    SummaryBatch,
    TableType,
    TagBatch,
} from "../types/embedding-batch.types";

@Injectable()
export class EmbeddingBatchDataService implements IBatchDataService {
    private readonly logger = new Logger(EmbeddingBatchDataService.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    async getFeedItemsBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<FeedItemBatch[]> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc(
                "fn_list_missing_feed_item_embeddings",
                {
                    p_user_id: userId,
                    p_limit: batchSize,
                    p_last_id: lastId,
                },
            );

            if (error) {
                this.logger.error(
                    `Error fetching feed items batch: ${error.message}`,
                );
                throw error;
            }

            return (
                data?.map((item) => ({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    contentText:
                        `${item.title} ${item.description || ""}`.trim(),
                })) || []
            );
        } catch (error) {
            this.logger.error(
                `Failed to fetch feed items batch: ${error.message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to fetch feed items batch: ${error.message}`,
                userId,
            );
        }
    }

    async getDailySummariesBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<SummaryBatch[]> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc(
                "fn_list_missing_summary_embeddings",
                {
                    p_user_id: userId,
                    p_limit: batchSize,
                    p_last_id: lastId,
                },
            );

            if (error) {
                this.logger.error(
                    `Error fetching summaries batch: ${error.message}`,
                );
                throw error;
            }

            return (
                data?.map((item) => ({
                    id: item.id,
                    summaryTitle: item.summary_title,
                    markdown: item.markdown,
                    contentText: item.markdown,
                })) || []
            );
        } catch (error) {
            this.logger.error(
                `Failed to fetch summaries batch: ${error.message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to fetch summaries batch: ${error.message}`,
                userId,
            );
        }
    }

    async getPodcastEpisodesBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<PodcastBatch[]> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc(
                "fn_list_missing_podcast_embeddings",
                {
                    p_user_id: userId,
                    p_limit: batchSize,
                    p_last_id: lastId,
                },
            );

            if (error) {
                this.logger.error(
                    `Error fetching podcast episodes batch: ${error.message}`,
                );
                throw error;
            }

            return (
                data?.map((item) => ({
                    id: item.id,
                    title: item.title,
                    contentText: item.title,
                })) || []
            );
        } catch (error) {
            this.logger.error(
                `Failed to fetch podcast episodes batch: ${error.message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to fetch podcast episodes batch: ${error.message}`,
                userId,
            );
        }
    }

    async getTagsBatch(
        userId: string,
        batchSize: number,
        lastId?: number,
    ): Promise<TagBatch[]> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc(
                "fn_list_missing_tag_embeddings",
                {
                    p_user_id: userId,
                    p_limit: batchSize,
                    p_last_id: lastId,
                },
            );

            if (error) {
                this.logger.error(
                    `Error fetching tags batch: ${error.message}`,
                );
                throw error;
            }

            return (
                data?.map((item) => ({
                    id: item.id,
                    tagName: item.tag_name,
                    description: item.description,
                    contentText:
                        `${item.tag_name} ${item.description || ""}`.trim(),
                })) || []
            );
        } catch (error) {
            this.logger.error(`Failed to fetch tags batch: ${error.message}`);
            throw new EmbeddingBatchException(
                `Failed to fetch tags batch: ${error.message}`,
                userId,
            );
        }
    }

    async getMissingEmbeddingsCount(
        userId: string,
        tableType: TableType,
    ): Promise<number> {
        try {
            const sb = this.admin.getClient();
            const { count, error } = await sb
                .from(tableType)
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .is(`${this.getEmbeddingColumn(tableType)}`, null)
                .eq("soft_deleted", false);

            if (error) {
                this.logger.error(
                    `Error getting missing embeddings count: ${error.message}`,
                );
                throw error;
            }

            return count || 0;
        } catch (error) {
            this.logger.error(
                `Failed to get missing embeddings count: ${error.message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to get missing embeddings count: ${error.message}`,
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

    private getEmbeddingColumn(tableType: TableType): string {
        const columnMap = {
            feed_items: "title_emb",
            daily_summaries: "summary_emb",
            podcast_episodes: "title_emb",
            tags: "tag_emb",
        } as const;
        return columnMap[tableType];
    }
}
