import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import { SearchResponseDto } from "../dto/search-response.dto";
import { SearchService } from "../services/search.service";

@ApiTags("Search")
@Controller("search")
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @Get("all")
    @ApiOperation({
        summary: "Search across all content types",
        description:
            "Search across feed items, summaries, and podcast episodes using vector similarity",
    })
    @ApiResponse({
        status: 200,
        description: "Search results returned successfully",
    })
    @ApiQuery({ name: "q", description: "Search query", required: true })
    @ApiQuery({
        name: "limit",
        description: "Maximum number of results (default: 20)",
        required: false,
    })
    @ApiQuery({
        name: "threshold",
        description: "Similarity threshold 0.0-1.0 (default: 0.7)",
        required: false,
    })
    @ApiQuery({
        name: "types",
        description:
            "Content types to search (comma-separated: feed_item,summary,podcast)",
        required: false,
    })
    async searchAll(
        @UserId() userId: string,
        @Query("q") query: string,
        @Query("limit") limit?: string,
        @Query("threshold") threshold?: string,
        @Query("types") types?: string,
    ): Promise<SearchResponseDto> {
        const searchData = {
            query,
            limit: limit ? Number.parseInt(limit, 10) : undefined,
            threshold: threshold ? Number.parseFloat(threshold) : undefined,
            includeTypes: types
                ? (types
                      .split(",")
                      .map((t) => t.trim())
                      .filter((t) =>
                          ["feed_item", "summary", "podcast"].includes(t),
                      ) as ("feed_item" | "summary" | "podcast")[])
                : undefined,
        };

        const results = await this.searchService.searchAll(userId, searchData);

        return {
            message: "Search completed successfully",
            data: results.map((result) => ({
                id: result.id,
                title: result.title,
                content: result.content,
                similarity: result.similarity,
                type: result.type,
                metadata: result.metadata,
            })),
        };
    }

    @Get("feed-items")
    @ApiOperation({
        summary: "Search feed items",
        description: "Search only feed items using vector similarity",
    })
    @ApiResponse({
        status: 200,
        description: "Feed item search results returned successfully",
    })
    @ApiQuery({ name: "q", description: "Search query", required: true })
    @ApiQuery({
        name: "limit",
        description: "Maximum number of results (default: 20)",
        required: false,
    })
    @ApiQuery({
        name: "threshold",
        description: "Similarity threshold 0.0-1.0 (default: 0.7)",
        required: false,
    })
    async searchFeedItems(
        @UserId() userId: string,
        @Query("q") query: string,
        @Query("limit") limit?: string,
        @Query("threshold") threshold?: string,
    ): Promise<SearchResponseDto> {
        const searchData = {
            query,
            limit: limit ? Number.parseInt(limit, 10) : undefined,
            threshold: threshold ? Number.parseFloat(threshold) : undefined,
        };

        const results = await this.searchService.searchFeedItems(
            userId,
            searchData,
        );

        return {
            message: "Feed item search completed successfully",
            data: results.map((result) => ({
                id: result.id,
                title: result.title,
                content: result.content,
                similarity: result.similarity,
                type: result.type,
                metadata: result.metadata,
            })),
        };
    }

    @Get("summaries")
    @ApiOperation({
        summary: "Search summaries",
        description: "Search only daily summaries using vector similarity",
    })
    @ApiResponse({
        status: 200,
        description: "Summary search results returned successfully",
    })
    @ApiQuery({ name: "q", description: "Search query", required: true })
    @ApiQuery({
        name: "limit",
        description: "Maximum number of results (default: 20)",
        required: false,
    })
    @ApiQuery({
        name: "threshold",
        description: "Similarity threshold 0.0-1.0 (default: 0.7)",
        required: false,
    })
    async searchSummaries(
        @UserId() userId: string,
        @Query("q") query: string,
        @Query("limit") limit?: string,
        @Query("threshold") threshold?: string,
    ): Promise<SearchResponseDto> {
        const searchData = {
            query,
            limit: limit ? Number.parseInt(limit, 10) : undefined,
            threshold: threshold ? Number.parseFloat(threshold) : undefined,
        };

        const results = await this.searchService.searchSummaries(
            userId,
            searchData,
        );

        return {
            message: "Summary search completed successfully",
            data: results.map((result) => ({
                id: result.id,
                title: result.title,
                content: result.content,
                similarity: result.similarity,
                type: result.type,
                metadata: result.metadata,
            })),
        };
    }

    @Get("podcasts")
    @ApiOperation({
        summary: "Search podcast episodes",
        description: "Search only podcast episodes using vector similarity",
    })
    @ApiResponse({
        status: 200,
        description: "Podcast search results returned successfully",
    })
    @ApiQuery({ name: "q", description: "Search query", required: true })
    @ApiQuery({
        name: "limit",
        description: "Maximum number of results (default: 20)",
        required: false,
    })
    @ApiQuery({
        name: "threshold",
        description: "Similarity threshold 0.0-1.0 (default: 0.7)",
        required: false,
    })
    async searchPodcasts(
        @UserId() userId: string,
        @Query("q") query: string,
        @Query("limit") limit?: string,
        @Query("threshold") threshold?: string,
    ): Promise<SearchResponseDto> {
        const searchData = {
            query,
            limit: limit ? Number.parseInt(limit, 10) : undefined,
            threshold: threshold ? Number.parseFloat(threshold) : undefined,
        };

        const results = await this.searchService.searchPodcastEpisodes(
            userId,
            searchData,
        );

        return {
            message: "Podcast search completed successfully",
            data: results.map((result) => ({
                id: result.id,
                title: result.title,
                content: result.content,
                similarity: result.similarity,
                type: result.type,
                metadata: result.metadata,
            })),
        };
    }
}
