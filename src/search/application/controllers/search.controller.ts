import { TypedQuery, TypedRoute } from "@nestia/core";
import { Controller, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import type { SearchResultEntity } from "@/search/domain/entities/search-result.entity";
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
            includeTypes: this.parseIncludeTypes(query.types),
        };

        const results = await this.searchService.searchAll(userId, searchData);

        return buildResponse(
            "Search completed successfully",
            this.toDtoList(results),
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
            this.toDtoList(results),
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
            this.toDtoList(results),
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
            this.toDtoList(results),
        );
    }

    private toDtoList(results: SearchResultEntity[]): SearchResultDto[] {
        return results.map((result) => this.toDto(result));
    }

    private toDto(result: SearchResultEntity): SearchResultDto {
        return {
            id: result.id,
            title: result.title,
            content: result.content,
            similarity: result.similarity,
            type: result.type === "feed_item" ? "feedItem" : result.type,
            metadata: this.normalizeMetadata(result.metadata),
        };
    }

    private normalizeMetadata(
        metadata: Record<string, string | number | boolean | null> | undefined,
    ): Record<string, string | number | boolean | null> | undefined {
        if (!metadata) return undefined;

        const normalized: Record<string, string | number | boolean | null> = {};
        for (const [key, value] of Object.entries(metadata)) {
            const camelKey = key.replace(/_([a-z])/g, (_, char: string) =>
                char.toUpperCase(),
            );
            normalized[camelKey] = value;
        }
        return normalized;
    }

    private parseIncludeTypes(
        raw?: string,
    ): ("feed_item" | "summary" | "podcast")[] | undefined {
        if (!raw) return undefined;
        const mapped = raw
            .split(",")
            .map((value) => this.normalizeRequestedType(value.trim()))
            .filter(
                (value): value is "feed_item" | "summary" | "podcast" =>
                    value !== null,
            );
        return mapped.length > 0 ? mapped : undefined;
    }

    private normalizeRequestedType(
        value: string,
    ): "feed_item" | "summary" | "podcast" | null {
        if (!value) return null;
        const lowered = value.toLowerCase();
        if (lowered === "feed_item" || lowered === "feeditem") {
            return "feed_item";
        }
        if (lowered === "summary") {
            return "summary";
        }
        if (lowered === "podcast") {
            return "podcast";
        }
        return null;
    }
}
