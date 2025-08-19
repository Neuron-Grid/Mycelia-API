import { Injectable, Logger } from "@nestjs/common";
import { SupabaseRequestService } from "../../../supabase-request.service";

export interface SupabaseSearchResult {
    id: number;
    title: string;
    content: string;
    similarity: number;
    type: "feed_item" | "summary" | "podcast";
    metadata: Record<string, unknown>;
}

@Injectable()
export class SupabaseSearchClient {
    private readonly logger = new Logger(SupabaseSearchClient.name);

    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
    ) {}

    async searchFeedItems(
        queryEmbedding: number[],
        threshold: number,
        limit: number,
    ): Promise<SupabaseSearchResult[]> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .rpc("search_feed_items_by_vector", {
                    query_embedding: queryEmbedding,
                    match_threshold: threshold,
                    match_count: limit,
                });

            if (error) {
                this.logger.error(
                    `Feed items vector search error: ${error.message}`,
                );
                throw error;
            }

            return data.map((item: Record<string, unknown>) => ({
                id: item.id as number,
                title: item.title as string,
                content: (item.description as string) || "",
                similarity: item.similarity as number,
                type: "feed_item" as const,
                metadata: {
                    link: item.link,
                    published_at: item.published_at,
                    feed_title: item.feed_title,
                },
            }));
        } catch (error) {
            this.logger.error(`Failed to search feed items: ${error.message}`);
            throw error;
        }
    }

    async searchSummaries(
        queryEmbedding: number[],
        threshold: number,
        limit: number,
    ): Promise<SupabaseSearchResult[]> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .rpc("search_summaries_by_vector", {
                    query_embedding: queryEmbedding,
                    match_threshold: threshold,
                    match_count: limit,
                });

            if (error) {
                this.logger.error(
                    `Summaries vector search error: ${error.message}`,
                );
                throw error;
            }

            return data.map((item: Record<string, unknown>) => ({
                id: item.id as number,
                title: (item.summary_title as string) || "No Title",
                content: (item.markdown as string) || "",
                similarity: item.similarity as number,
                type: "summary" as const,
                metadata: {
                    summary_date: item.summary_date,
                    has_script: !!item.script_text,
                },
            }));
        } catch (error) {
            this.logger.error(`Failed to search summaries: ${error.message}`);
            throw error;
        }
    }

    async searchPodcastEpisodes(
        queryEmbedding: number[],
        threshold: number,
        limit: number,
    ): Promise<SupabaseSearchResult[]> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .rpc("search_podcast_episodes_by_vector", {
                    query_embedding: queryEmbedding,
                    match_threshold: threshold,
                    match_count: limit,
                });

            if (error) {
                this.logger.error(
                    `Podcast episodes vector search error: ${error.message}`,
                );
                throw error;
            }

            return data.map((item: Record<string, unknown>) => ({
                id: item.id as number,
                title: (item.title as string) || "No Title",
                content: (item.title as string) || "",
                similarity: item.similarity as number,
                type: "podcast" as const,
                metadata: {
                    audio_url: item.audio_url,
                    summary_id: item.summary_id,
                    created_at: item.created_at,
                },
            }));
        } catch (error) {
            this.logger.error(
                `Failed to search podcast episodes: ${error.message}`,
            );
            throw error;
        }
    }

    async updateFeedItemEmbedding(
        feedItemId: number,
        userId: string,
        embedding: number[],
    ): Promise<void> {
        try {
            const { error } = await this.supabaseRequestService
                .getClient()
                .from("feed_items")
                .update({
                    title_emb: JSON.stringify(embedding),
                } as Record<string, unknown>)
                .eq("id", feedItemId)
                .eq("user_id", userId);

            if (error) throw error;

            this.logger.debug(`Updated embedding for feed item ${feedItemId}`);
        } catch (error) {
            this.logger.error(
                `Failed to update feed item embedding: ${error.message}`,
            );
            throw error;
        }
    }

    async updateSummaryEmbedding(
        summaryId: number,
        userId: string,
        embedding: number[],
    ): Promise<void> {
        try {
            const { error } = await this.supabaseRequestService
                .getClient()
                .from("daily_summaries")
                .update({ summary_emb: JSON.stringify(embedding) })
                .eq("id", summaryId)
                .eq("user_id", userId);

            if (error) throw error;

            this.logger.debug(`Updated embedding for summary ${summaryId}`);
        } catch (error) {
            this.logger.error(
                `Failed to update summary embedding: ${error.message}`,
            );
            throw error;
        }
    }

    async updatePodcastEpisodeEmbedding(
        episodeId: number,
        userId: string,
        embedding: number[],
    ): Promise<void> {
        try {
            const { error } = await this.supabaseRequestService
                .getClient()
                .from("podcast_episodes")
                .update({ title_emb: JSON.stringify(embedding) })
                .eq("id", episodeId)
                .eq("user_id", userId);

            if (error) throw error;

            this.logger.debug(
                `Updated embedding for podcast episode ${episodeId}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to update podcast episode embedding: ${error.message}`,
            );
            throw error;
        }
    }
}
