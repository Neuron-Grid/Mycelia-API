import { TypedRoute } from "@nestia/core";
import { Controller, Query, UseGuards } from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiExtraModels,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from "@nestjs/swagger";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import { ErrorResponseDto } from "@/common/dto/error-response.dto";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import { SearchResultDto } from "../dto/search-response.dto";
import { SearchService } from "../services/search.service";

@ApiTags("Search")
@Controller("search")
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@ApiExtraModels(SearchResultDto)
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @TypedRoute.Get("all")
    @ApiOperation({
        summary: "Search across all content types",
        description:
            "Search across feed items, summaries, and podcast episodes using vector similarity",
    })
    @ApiResponse({
        status: 200,
        description: "Returns { message, data: SearchResultDto[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "array",
                    items: { $ref: getSchemaPath(SearchResultDto) },
                },
            },
        },
    })
    @ApiQuery({ name: "q", description: "Search query", required: true })
    @ApiQuery({
        name: "limit",
        description: "Maximum number of results (default: 20)",
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: "threshold",
        description: "Similarity threshold 0.0-1.0 (default: 0.7)",
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: "types",
        description:
            "Content types to search (comma-separated: feed_item,summary,podcast)",
        required: false,
    })
    @ApiResponse({
        status: 401,
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    async searchAll(
        @UserId() userId: string,
        @Query("q") query: string,
        @Query("limit") limit?: number,
        @Query("threshold") threshold?: number,
        @Query("types") types?: string,
    ): Promise<SuccessResponse<SearchResultDto[]>> {
        const searchData = {
            query,
            limit,
            threshold,
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

    @TypedRoute.Get("feed-items")
    @ApiOperation({
        summary: "Search feed items",
        description: "Search only feed items using vector similarity",
    })
    @ApiResponse({
        status: 200,
        description: "Returns { message, data: SearchResultDto[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "array",
                    items: { $ref: getSchemaPath(SearchResultDto) },
                },
            },
        },
    })
    @ApiQuery({ name: "q", description: "Search query", required: true })
    @ApiQuery({
        name: "limit",
        description: "Maximum number of results (default: 20)",
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: "threshold",
        description: "Similarity threshold 0.0-1.0 (default: 0.7)",
        required: false,
        type: Number,
    })
    @ApiResponse({
        status: 401,
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    async searchFeedItems(
        @UserId() userId: string,
        @Query("q") query: string,
        @Query("limit") limit?: number,
        @Query("threshold") threshold?: number,
    ): Promise<SuccessResponse<SearchResultDto[]>> {
        const searchData = {
            query,
            limit,
            threshold,
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

    @TypedRoute.Get("summaries")
    @ApiOperation({
        summary: "Search summaries",
        description: "Search only daily summaries using vector similarity",
    })
    @ApiResponse({
        status: 200,
        description: "Returns { message, data: SearchResultDto[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "array",
                    items: { $ref: getSchemaPath(SearchResultDto) },
                },
            },
        },
    })
    @ApiQuery({ name: "q", description: "Search query", required: true })
    @ApiQuery({
        name: "limit",
        description: "Maximum number of results (default: 20)",
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: "threshold",
        description: "Similarity threshold 0.0-1.0 (default: 0.7)",
        required: false,
        type: Number,
    })
    @ApiResponse({
        status: 401,
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    async searchSummaries(
        @UserId() userId: string,
        @Query("q") query: string,
        @Query("limit") limit?: number,
        @Query("threshold") threshold?: number,
    ): Promise<SuccessResponse<SearchResultDto[]>> {
        const searchData = {
            query,
            limit,
            threshold,
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

    @TypedRoute.Get("podcasts")
    @ApiOperation({
        summary: "Search podcast episodes",
        description: "Search only podcast episodes using vector similarity",
    })
    @ApiResponse({
        status: 200,
        description: "Returns { message, data: SearchResultDto[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "array",
                    items: { $ref: getSchemaPath(SearchResultDto) },
                },
            },
        },
    })
    @ApiQuery({ name: "q", description: "Search query", required: true })
    @ApiQuery({
        name: "limit",
        description: "Maximum number of results (default: 20)",
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: "threshold",
        description: "Similarity threshold 0.0-1.0 (default: 0.7)",
        required: false,
        type: Number,
    })
    @ApiResponse({
        status: 401,
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    async searchPodcasts(
        @UserId() userId: string,
        @Query("q") query: string,
        @Query("limit") limit?: number,
        @Query("threshold") threshold?: number,
    ): Promise<SuccessResponse<SearchResultDto[]>> {
        const searchData = {
            query,
            limit,
            threshold,
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
