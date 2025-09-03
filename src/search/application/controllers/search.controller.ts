import { TypedQuery, TypedRoute } from "@nestia/core";
import { Controller, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import { SearchResultDto } from "../dto/search-response.dto";
import { SearchService } from "../services/search.service";

@Controller("search")
@UseGuards(SupabaseAuthGuard)
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    /** Search across all content types */
    @TypedRoute.Get("all")
    async searchAll(
        @UserId() userId: string,
        @TypedQuery<{
            q: string;
            limit?: number;
            threshold?: number;
            types?: string;
        }>()
        query: {
            q: string;
            limit?: number;
            threshold?: number;
            types?: string;
        },
    ): Promise<SuccessResponse<SearchResultDto[]>> {
        const searchData = {
            query: query.q,
            limit: query.limit,
            threshold: query.threshold,
            includeTypes: query.types
                ? (query.types
                      .split(",")
                      .map((t) => t.trim())
                      .filter((t) =>
                          ["feed_item", "summary", "podcast"].includes(t),
                      ) as ("feed_item" | "summary" | "podcast")[])
                : undefined,
        };

        const results = await this.searchService.searchAll(userId, searchData);

        return buildResponse(
            "Search completed successfully",
            results.map((result) => ({
                id: result.id,
                title: result.title,
                content: result.content,
                similarity: result.similarity,
                type: result.type,
                metadata: result.metadata,
            })),
        );
    }

    /** Search only feed items using vector similarity */
    @TypedRoute.Get("feed-items")
    async searchFeedItems(
        @UserId() userId: string,
        @TypedQuery<{ q: string; limit?: number; threshold?: number }>()
        q: { q: string; limit?: number; threshold?: number },
    ): Promise<SuccessResponse<SearchResultDto[]>> {
        const searchData = {
            query: q.q,
            limit: q.limit,
            threshold: q.threshold,
        };

        const results = await this.searchService.searchFeedItems(
            userId,
            searchData,
        );

        return buildResponse(
            "Feed item search completed successfully",
            results.map((result) => ({
                id: result.id,
                title: result.title,
                content: result.content,
                similarity: result.similarity,
                type: result.type,
                metadata: result.metadata,
            })),
        );
    }

    /** Search only daily summaries using vector similarity */
    @TypedRoute.Get("summaries")
    async searchSummaries(
        @UserId() userId: string,
        @TypedQuery<{ q: string; limit?: number; threshold?: number }>()
        q: { q: string; limit?: number; threshold?: number },
    ): Promise<SuccessResponse<SearchResultDto[]>> {
        const searchData = {
            query: q.q,
            limit: q.limit,
            threshold: q.threshold,
        };

        const results = await this.searchService.searchSummaries(
            userId,
            searchData,
        );

        return buildResponse(
            "Summary search completed successfully",
            results.map((result) => ({
                id: result.id,
                title: result.title,
                content: result.content,
                similarity: result.similarity,
                type: result.type,
                metadata: result.metadata,
            })),
        );
    }

    /** Search only podcast episodes using vector similarity */
    @TypedRoute.Get("podcasts")
    async searchPodcasts(
        @UserId() userId: string,
        @TypedQuery<{ q: string; limit?: number; threshold?: number }>()
        q: { q: string; limit?: number; threshold?: number },
    ): Promise<SuccessResponse<SearchResultDto[]>> {
        const searchData = {
            query: q.q,
            limit: q.limit,
            threshold: q.threshold,
        };

        const results = await this.searchService.searchPodcastEpisodes(
            userId,
            searchData,
        );

        return buildResponse(
            "Podcast search completed successfully",
            results.map((result) => ({
                id: result.id,
                title: result.title,
                content: result.content,
                similarity: result.similarity,
                type: result.type,
                metadata: result.metadata,
            })),
        );
    }
}
