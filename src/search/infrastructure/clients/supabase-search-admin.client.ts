import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { Database } from "@/types/schema";

/**
 * Worker向けの検索クライアント。
 * - service-role権限を利用し、REQUESTスコープを要求しない。
 * - 検索系メソッドはWorkerでは想定されないため明示的に未対応とする。
 */
@Injectable()
export class SupabaseSearchAdminClient {
    private readonly logger = new Logger(SupabaseSearchAdminClient.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    private unsupported(): Promise<never> {
        return Promise.reject(
            new Error(
                "Search operations are not supported in worker context. Use API SearchModule instead.",
            ),
        );
    }

    // 検索系はWorkerで使用しないため安全のため封じる
    searchFeedItems(
        _queryEmbedding: number[],
        _threshold: number,
        _limit: number,
    ): Promise<never> {
        return this.unsupported();
    }

    searchSummaries(
        _queryEmbedding: number[],
        _threshold: number,
        _limit: number,
    ): Promise<never> {
        return this.unsupported();
    }

    searchPodcastEpisodes(
        _queryEmbedding: number[],
        _threshold: number,
        _limit: number,
    ): Promise<never> {
        return this.unsupported();
    }

    async updateFeedItemEmbedding(
        feedItemId: number,
        userId: string,
        embedding: number[],
    ): Promise<void> {
        const payload: Database["public"]["Functions"]["fn_update_feed_item_embedding"]["Args"] =
            {
                p_user_id: userId,
                p_id: feedItemId,
                p_vec: embedding,
            };
        const { error } = await this.admin
            .getClient()
            .rpc("fn_update_feed_item_embedding", payload);

        if (error) {
            this.logger.error(
                `fn_update_feed_item_embedding failed (id=${feedItemId}): ${error.message}`,
            );
            throw error;
        }
    }

    async updateSummaryEmbedding(
        summaryId: number,
        userId: string,
        embedding: number[],
    ): Promise<void> {
        const payload: Database["public"]["Functions"]["fn_update_summary_embedding"]["Args"] =
            {
                p_user_id: userId,
                p_id: summaryId,
                p_vec: embedding,
            };
        const { error } = await this.admin
            .getClient()
            .rpc("fn_update_summary_embedding", payload);

        if (error) {
            this.logger.error(
                `fn_update_summary_embedding failed (id=${summaryId}): ${error.message}`,
            );
            throw error;
        }
    }

    async updatePodcastEpisodeEmbedding(
        episodeId: number,
        userId: string,
        embedding: number[],
    ): Promise<void> {
        const payload: Database["public"]["Functions"]["fn_update_podcast_embedding"]["Args"] =
            {
                p_user_id: userId,
                p_id: episodeId,
                p_vec: embedding,
            };
        const { error } = await this.admin
            .getClient()
            .rpc("fn_update_podcast_embedding", payload);

        if (error) {
            this.logger.error(
                `fn_update_podcast_embedding failed (id=${episodeId}): ${error.message}`,
            );
            throw error;
        }
    }
}
