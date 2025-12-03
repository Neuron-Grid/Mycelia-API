import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";

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
        const { error } = await this.admin
            .getClient()
            .from("feed_items")
            .update({ title_emb: embedding } as Record<string, unknown>)
            .eq("id", feedItemId)
            .eq("user_id", userId);

        if (error) {
            this.logger.error(
                `Failed to update feed item embedding (id=${feedItemId}): ${error.message}`,
            );
            throw error;
        }
    }

    async updateSummaryEmbedding(
        summaryId: number,
        userId: string,
        embedding: number[],
    ): Promise<void> {
        const { error } = await this.admin
            .getClient()
            .from("daily_summaries")
            .update({ summary_emb: embedding } as Record<string, unknown>)
            .eq("id", summaryId)
            .eq("user_id", userId);

        if (error) {
            this.logger.error(
                `Failed to update summary embedding (id=${summaryId}): ${error.message}`,
            );
            throw error;
        }
    }

    async updatePodcastEpisodeEmbedding(
        episodeId: number,
        userId: string,
        embedding: number[],
    ): Promise<void> {
        const { error } = await this.admin
            .getClient()
            .from("podcast_episodes")
            .update({ title_emb: embedding } as Record<string, unknown>)
            .eq("id", episodeId)
            .eq("user_id", userId);

        if (error) {
            this.logger.error(
                `Failed to update podcast episode embedding (id=${episodeId}): ${error.message}`,
            );
            throw error;
        }
    }
}
