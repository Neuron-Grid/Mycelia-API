import { Controller, Get, Query, UseGuards, ValidationPipe } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { User } from '@supabase/supabase-js'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import { SupabaseUser } from '../auth/supabase-user.decorator'
import { SearchOptions, SearchResult, VectorSearchService } from './vector-search.service'

@ApiTags('Search')
@Controller('search')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
export class SearchController {
    constructor(private readonly vectorSearchService: VectorSearchService) {}

    @Get('all')
    @ApiOperation({
        summary: 'Search across all content types',
        description:
            'Search across feed items, summaries, and podcast episodes using vector similarity',
    })
    @ApiResponse({ status: 200, description: 'Search results returned successfully' })
    @ApiQuery({ name: 'q', description: 'Search query', required: true })
    @ApiQuery({
        name: 'limit',
        description: 'Maximum number of results (default: 20)',
        required: false,
    })
    @ApiQuery({
        name: 'threshold',
        description: 'Similarity threshold 0.0-1.0 (default: 0.7)',
        required: false,
    })
    @ApiQuery({
        name: 'types',
        description: 'Content types to search (comma-separated: feed_item,summary,podcast)',
        required: false,
    })
    async searchAll(
        @SupabaseUser() user: User,
        @Query('q') query: string,
        @Query('limit') limit?: string,
        @Query('threshold') threshold?: string,
        @Query('types') types?: string,
    ): Promise<{ message: string; data: SearchResult[] }> {
        if (!user?.id) {
            throw new Error('User ID not found')
        }

        const options: SearchOptions = {
            limit: limit ? Number.parseInt(limit, 10) : 20,
            threshold: threshold ? Number.parseFloat(threshold) : 0.7,
        }

        if (types) {
            const typeArray = types.split(',').map((t) => t.trim()) as (
                | 'feed_item'
                | 'summary'
                | 'podcast'
            )[]
            options.includeTypes = typeArray.filter((t) =>
                ['feed_item', 'summary', 'podcast'].includes(t),
            )
        }

        const results = await this.vectorSearchService.searchAll(user.id, query, options)

        return {
            message: 'Search completed successfully',
            data: results,
        }
    }

    @Get('feed-items')
    @ApiOperation({
        summary: 'Search feed items',
        description: 'Search only feed items using vector similarity',
    })
    @ApiResponse({ status: 200, description: 'Feed item search results returned successfully' })
    @ApiQuery({ name: 'q', description: 'Search query', required: true })
    @ApiQuery({
        name: 'limit',
        description: 'Maximum number of results (default: 20)',
        required: false,
    })
    @ApiQuery({
        name: 'threshold',
        description: 'Similarity threshold 0.0-1.0 (default: 0.7)',
        required: false,
    })
    async searchFeedItems(
        @SupabaseUser() user: User,
        @Query('q') query: string,
        @Query('limit') limit?: string,
        @Query('threshold') threshold?: string,
    ): Promise<{ message: string; data: SearchResult[] }> {
        if (!user?.id) {
            throw new Error('User ID not found')
        }

        const options: SearchOptions = {
            limit: limit ? Number.parseInt(limit, 10) : 20,
            threshold: threshold ? Number.parseFloat(threshold) : 0.7,
        }

        const results = await this.vectorSearchService.searchFeedItems(user.id, query, options)

        return {
            message: 'Feed item search completed successfully',
            data: results,
        }
    }

    @Get('summaries')
    @ApiOperation({
        summary: 'Search summaries',
        description: 'Search only daily summaries using vector similarity',
    })
    @ApiResponse({ status: 200, description: 'Summary search results returned successfully' })
    @ApiQuery({ name: 'q', description: 'Search query', required: true })
    @ApiQuery({
        name: 'limit',
        description: 'Maximum number of results (default: 20)',
        required: false,
    })
    @ApiQuery({
        name: 'threshold',
        description: 'Similarity threshold 0.0-1.0 (default: 0.7)',
        required: false,
    })
    async searchSummaries(
        @SupabaseUser() user: User,
        @Query('q') query: string,
        @Query('limit') limit?: string,
        @Query('threshold') threshold?: string,
    ): Promise<{ message: string; data: SearchResult[] }> {
        if (!user?.id) {
            throw new Error('User ID not found')
        }

        const options: SearchOptions = {
            limit: limit ? Number.parseInt(limit, 10) : 20,
            threshold: threshold ? Number.parseFloat(threshold) : 0.7,
        }

        const results = await this.vectorSearchService.searchSummaries(user.id, query, options)

        return {
            message: 'Summary search completed successfully',
            data: results,
        }
    }

    @Get('podcasts')
    @ApiOperation({
        summary: 'Search podcast episodes',
        description: 'Search only podcast episodes using vector similarity',
    })
    @ApiResponse({ status: 200, description: 'Podcast search results returned successfully' })
    @ApiQuery({ name: 'q', description: 'Search query', required: true })
    @ApiQuery({
        name: 'limit',
        description: 'Maximum number of results (default: 20)',
        required: false,
    })
    @ApiQuery({
        name: 'threshold',
        description: 'Similarity threshold 0.0-1.0 (default: 0.7)',
        required: false,
    })
    async searchPodcasts(
        @SupabaseUser() user: User,
        @Query('q') query: string,
        @Query('limit') limit?: string,
        @Query('threshold') threshold?: string,
    ): Promise<{ message: string; data: SearchResult[] }> {
        if (!user?.id) {
            throw new Error('User ID not found')
        }

        const options: SearchOptions = {
            limit: limit ? Number.parseInt(limit, 10) : 20,
            threshold: threshold ? Number.parseFloat(threshold) : 0.7,
        }

        const results = await this.vectorSearchService.searchPodcastEpisodes(
            user.id,
            query,
            options,
        )

        return {
            message: 'Podcast search completed successfully',
            data: results,
        }
    }
}
