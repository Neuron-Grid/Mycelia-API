import {
    Controller,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { User } from '@supabase/supabase-js'
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard'
import { SupabaseUser } from 'src/auth/supabase-user.decorator'
import { FavoriteService } from './favorite.service'

@ApiTags('Favorites')
@ApiBearerAuth()
@Controller({
    path: 'favorites',
    version: '1',
})
@UseGuards(SupabaseAuthGuard)
export class FavoriteController {
    constructor(private readonly favoriteService: FavoriteService) {}

    // ユーザーのお気に入り一覧
    @ApiOperation({ summary: 'Get all favorites for current user' })
    @ApiResponse({ status: 200, description: 'Returns all favorited feed items for the user' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Get()
    async getUserFavorites(@SupabaseUser() user: User) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            const favorites = await this.favoriteService.getUserFavorites(user.id)
            return { message: 'Favorites fetched', data: favorites }
        } catch (err) {
            throw new HttpException(err.message, HttpStatus.BAD_REQUEST)
        }
    }

    // 特定FeedItemがお気に入りか確認
    @ApiOperation({ summary: 'Check if a feed item is favorited' })
    @ApiParam({ name: 'feedItemId', description: 'ID of the feed item to check' })
    @ApiResponse({ status: 200, description: 'Returns whether the feed item is favorited' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Get(':feedItemId/is-favorited')
    async checkFavorite(
        @SupabaseUser() user: User,
        @Param('feedItemId', ParseIntPipe) feedItemId: number,
    ) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            const isFav = await this.favoriteService.isFavorited(user.id, feedItemId)
            return { message: 'Favorite check', data: { favorited: isFav } }
        } catch (err) {
            throw new HttpException(err.message, HttpStatus.BAD_REQUEST)
        }
    }

    // FeedItemをお気に入り登録
    @ApiOperation({ summary: 'Add a feed item to favorites' })
    @ApiParam({ name: 'feedItemId', description: 'ID of the feed item to favorite' })
    @ApiResponse({ status: 201, description: 'Feed item favorited successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Post(':feedItemId')
    async favoriteItem(
        @SupabaseUser() user: User,
        @Param('feedItemId', ParseIntPipe) feedItemId: number,
    ) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            const result = await this.favoriteService.favoriteFeedItem(user.id, feedItemId)
            return { message: 'Feed item favorited', data: result }
        } catch (err) {
            throw new HttpException(err.message, HttpStatus.BAD_REQUEST)
        }
    }

    // FeedItemのお気に入りを解除
    @ApiOperation({ summary: 'Remove a feed item from favorites' })
    @ApiParam({ name: 'feedItemId', description: 'ID of the feed item to unfavorite' })
    @ApiResponse({ status: 200, description: 'Feed item unfavorited successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Delete(':feedItemId')
    async unfavoriteItem(
        @SupabaseUser() user: User,
        @Param('feedItemId', ParseIntPipe) feedItemId: number,
    ) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            await this.favoriteService.unfavoriteFeedItem(user.id, feedItemId)
            return { message: 'Feed item unfavorited' }
        } catch (err) {
            throw new HttpException(err.message, HttpStatus.BAD_REQUEST)
        }
    }
}
