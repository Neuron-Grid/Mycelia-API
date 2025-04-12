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
import { User } from '@supabase/supabase-js'
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard'
import { SupabaseUser } from 'src/auth/supabase-user.decorator'
import { FavoriteService } from './favorite.service'

@Controller({
    path: 'favorites',
    version: '1',
})
@UseGuards(SupabaseAuthGuard)
export class FavoriteController {
    constructor(private readonly favoriteService: FavoriteService) {}

    // ユーザーのお気に入り一覧
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
