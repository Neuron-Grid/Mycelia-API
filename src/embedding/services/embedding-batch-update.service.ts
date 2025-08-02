import { Injectable, Logger } from "@nestjs/common";
import { SupabaseRequestService } from "../../supabase-request.service";
import {
    EmbeddingBatchException,
    InvalidTableTypeException,
} from "../exceptions/embedding-batch.exceptions";
import { IBatchUpdateService } from "../interfaces/batch-data.interface";
import { EmbeddingUpdateItem, TableType } from "../types/embedding-batch.types";

@Injectable()
export class EmbeddingBatchUpdateService implements IBatchUpdateService {
    private readonly logger = new Logger(EmbeddingBatchUpdateService.name);

    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
    ) {}

    async updateFeedItemsEmbeddings(
        userId: string,
        items: EmbeddingUpdateItem[],
    ): Promise<void> {
        try {
            const updatePromises = items.map((item) =>
                this.supabaseRequestService
                    .getClient()
                    .from("feed_items")
                    .update({ title_emb: JSON.stringify(item.embedding) })
                    .eq("id", item.id)
                    .eq("user_id", userId),
            );

            const results = await Promise.allSettled(updatePromises);

            const failures = results.filter(
                (result) => result.status === "rejected",
            );
            if (failures.length > 0) {
                this.logger.error(
                    `Failed to update ${failures.length} feed items`,
                );
                throw new Error(
                    `Failed to update ${failures.length} feed items`,
                );
            }

            this.logger.debug(
                `Successfully updated ${items.length} feed items embeddings`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to update feed items embeddings: ${error.message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to update feed items embeddings: ${error.message}`,
                userId,
            );
        }
    }

    async updateSummariesEmbeddings(
        userId: string,
        items: EmbeddingUpdateItem[],
    ): Promise<void> {
        try {
            const updatePromises = items.map((item) =>
                this.supabaseRequestService
                    .getClient()
                    .from("daily_summaries")
                    .update({
                        summary_emb: JSON.stringify(item.embedding),
                    })
                    .eq("id", item.id)
                    .eq("user_id", userId),
            );

            const results = await Promise.allSettled(updatePromises);

            const failures = results.filter(
                (result) => result.status === "rejected",
            );
            if (failures.length > 0) {
                this.logger.error(
                    `Failed to update ${failures.length} summaries`,
                );
                throw new Error(
                    `Failed to update ${failures.length} summaries`,
                );
            }

            this.logger.debug(
                `Successfully updated ${items.length} summaries embeddings`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to update summaries embeddings: ${error.message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to update summaries embeddings: ${error.message}`,
                userId,
            );
        }
    }

    async updatePodcastEpisodesEmbeddings(
        userId: string,
        items: EmbeddingUpdateItem[],
    ): Promise<void> {
        try {
            const updatePromises = items.map((item) =>
                this.supabaseRequestService
                    .getClient()
                    .from("podcast_episodes")
                    .update({ title_emb: JSON.stringify(item.embedding) })
                    .eq("id", item.id)
                    .eq("user_id", userId),
            );

            const results = await Promise.allSettled(updatePromises);

            const failures = results.filter(
                (result) => result.status === "rejected",
            );
            if (failures.length > 0) {
                this.logger.error(
                    `Failed to update ${failures.length} podcast episodes`,
                );
                throw new Error(
                    `Failed to update ${failures.length} podcast episodes`,
                );
            }

            this.logger.debug(
                `Successfully updated ${items.length} podcast episodes embeddings`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to update podcast episodes embeddings: ${error.message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to update podcast episodes embeddings: ${error.message}`,
                userId,
            );
        }
    }

    async updateTagsEmbeddings(
        userId: string,
        items: EmbeddingUpdateItem[],
    ): Promise<void> {
        try {
            const updatePromises = items.map((item) =>
                this.supabaseRequestService
                    .getClient()
                    .from("tags")
                    .update({ tag_emb: JSON.stringify(item.embedding) })
                    .eq("id", item.id)
                    .eq("user_id", userId),
            );

            const results = await Promise.allSettled(updatePromises);

            const failures = results.filter(
                (result) => result.status === "rejected",
            );
            if (failures.length > 0) {
                this.logger.error(`Failed to update ${failures.length} tags`);
                throw new Error(`Failed to update ${failures.length} tags`);
            }

            this.logger.debug(
                `Successfully updated ${items.length} tags embeddings`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to update tags embeddings: ${error.message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to update tags embeddings: ${error.message}`,
                userId,
            );
        }
    }

    async updateEmbeddings(
        userId: string,
        tableType: TableType,
        items: EmbeddingUpdateItem[],
    ): Promise<void> {
        switch (tableType) {
            case "feed_items":
                return await this.updateFeedItemsEmbeddings(userId, items);
            case "daily_summaries":
                return await this.updateSummariesEmbeddings(userId, items);
            case "podcast_episodes":
                return await this.updatePodcastEpisodesEmbeddings(
                    userId,
                    items,
                );
            case "tags":
                return await this.updateTagsEmbeddings(userId, items);
            default:
                throw new InvalidTableTypeException(tableType);
        }
    }
}
