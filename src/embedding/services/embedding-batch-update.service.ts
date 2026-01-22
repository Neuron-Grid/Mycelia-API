import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { Database } from "@/types/schema";
import {
    EmbeddingBatchException,
    InvalidTableTypeException,
} from "../exceptions/embedding-batch.exceptions";
import { IBatchUpdateService } from "../interfaces/batch-data.interface";
import { EmbeddingUpdateItem, TableType } from "../types/embedding-batch.types";

type EmbeddingUpdateRpc = keyof Database["public"]["Functions"];

type EmbeddingUpdateConfig = {
    rpc: EmbeddingUpdateRpc;
    label: string;
};

const EMBEDDING_UPDATE_CONFIG: Record<TableType, EmbeddingUpdateConfig> = {
    feed_items: {
        rpc: "fn_update_feed_item_embedding",
        label: "feed items",
    },
    daily_summaries: {
        rpc: "fn_update_summary_embedding",
        label: "summaries",
    },
    podcast_episodes: {
        rpc: "fn_update_podcast_embedding",
        label: "podcast episodes",
    },
    tags: {
        rpc: "fn_update_tag_embedding",
        label: "tags",
    },
} as const;

@Injectable()
export class EmbeddingBatchUpdateService implements IBatchUpdateService {
    private readonly logger = new Logger(EmbeddingBatchUpdateService.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    async updateEmbeddings(
        userId: string,
        tableType: TableType,
        items: EmbeddingUpdateItem[],
    ): Promise<void> {
        const config = EMBEDDING_UPDATE_CONFIG[tableType];
        if (!config) {
            throw new InvalidTableTypeException(tableType);
        }
        return await this.updateEmbeddingsByConfig(userId, items, config);
    }

    private async updateEmbeddingsByConfig(
        userId: string,
        items: EmbeddingUpdateItem[],
        config: EmbeddingUpdateConfig,
    ): Promise<void> {
        try {
            const sb = this.admin.getClient();
            const updatePromises = items.map((item) =>
                sb.rpc(config.rpc, {
                    p_user_id: userId,
                    p_id: item.id,
                    p_vec: item.embedding as number[],
                }),
            );

            const results = await Promise.allSettled(updatePromises);
            const failures = results.filter(
                (result) => result.status === "rejected",
            );
            if (failures.length > 0) {
                this.logger.error(
                    `Failed to update ${failures.length} ${config.label}`,
                );
                throw new Error(
                    `Failed to update ${failures.length} ${config.label}`,
                );
            }

            this.logger.debug(
                `Successfully updated ${items.length} ${config.label} embeddings`,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to update ${config.label} embeddings: ${message}`,
            );
            throw new EmbeddingBatchException(
                `Failed to update ${config.label} embeddings: ${message}`,
                userId,
            );
        }
    }
}
