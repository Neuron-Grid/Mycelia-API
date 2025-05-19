// @file お気に入り機能のAPIコントローラ
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
// @see https://docs.nestjs.com/openapi/introduction
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
// @see https://supabase.com/docs/reference/javascript/auth-api
import { User } from '@supabase/supabase-js'
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard'
import { SupabaseUser } from 'src/auth/supabase-user.decorator'
import { FavoriteService } from './favorite.service'
import { buildResponse } from './response.util'

@ApiTags('Favorites')
@ApiBearerAuth()
@Controller({
    path: 'favorites',
    version: '1',
})
@UseGuards(SupabaseAuthGuard)
// @public
// @since 1.0.0
export class FavoriteController {
    // @param {FavoriteService} favoriteService - お気に入りサービス
    // @since 1.0.0
    // @public
    constructor(private readonly favoriteService: FavoriteService) {}

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @returns {Promise<unknown>} - お気に入り一覧
    // @throws {HttpException} - 認証エラーや取得失敗時
    // @example
    // await favoriteController.getUserFavorites(user)
    // @see FavoriteService.getUserFavorites
    @Get()
    async getUserFavorites(@SupabaseUser() user: User) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            const favorites = await this.favoriteService.getUserFavorites(user.id)
            return buildResponse('Favorites fetched', favorites)
        } catch (err) {
            throw new HttpException(err.message, HttpStatus.BAD_REQUEST)
        }
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} feedItemId - チェック対象FeedItemのID
    // @returns {Promise<unknown>} - お気に入り判定結果
    // @throws {HttpException} - 認証エラーや取得失敗時
    // @example
    // await favoriteController.checkFavorite(user, 1)
    // @see FavoriteService.isFavorited
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
            return buildResponse('Favorite check', { favorited: isFav })
        } catch (err) {
            throw new HttpException(err.message, HttpStatus.BAD_REQUEST)
        }
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} feedItemId - お気に入り登録対象FeedItemのID
    // @returns {Promise<unknown>} - 登録結果
    // @throws {HttpException} - 認証エラーや登録失敗時
    // @example
    // await favoriteController.favoriteItem(user, 1)
    // @see FavoriteService.favoriteFeedItem
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
            return buildResponse('Feed item favorited', result)
        } catch (err) {
            throw new HttpException(err.message, HttpStatus.BAD_REQUEST)
        }
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} feedItemId - お気に入り解除対象FeedItemのID
    // @returns {Promise<unknown>} - 解除結果
    // @throws {HttpException} - 認証エラーや解除失敗時
    // @example
    // await favoriteController.unfavoriteItem(user, 1)
    // @see FavoriteService.unfavoriteFeedItem
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
            return buildResponse('Feed item unfavorited')
        } catch (err) {
            throw new HttpException(err.message, HttpStatus.BAD_REQUEST)
        }
    }
}
