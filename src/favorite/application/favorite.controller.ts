// @file お気に入り機能のAPIコントローラ
import {
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    UseGuards,
} from "@nestjs/common";
// @see https://docs.nestjs.com/openapi/introduction
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
// @see https://supabase.com/docs/reference/javascript/auth-api
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import { FavoriteService } from "./favorite.service";
import { buildResponse } from "./response.util";

@ApiTags("Favorites")
@ApiBearerAuth()
@Controller({
    path: "favorites",
    version: "1",
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
    async getUserFavorites(@UserId() userId: string) {
        const favorites = await this.favoriteService.getUserFavorites(userId);
        return buildResponse("Favorites fetched", favorites);
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
    @Get(":feedItemId/is-favorited")
    async checkFavorite(
        @UserId() userId: string,
        @Param("feedItemId", ParseIntPipe) feedItemId: number,
    ) {
        const isFav = await this.favoriteService.isFavorited(
            userId,
            feedItemId,
        );
        return buildResponse("Favorite check", { favorited: isFav });
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
    @Post(":feedItemId")
    async favoriteItem(
        @UserId() userId: string,
        @Param("feedItemId", ParseIntPipe) feedItemId: number,
    ) {
        const result = await this.favoriteService.favoriteFeedItem(
            userId,
            feedItemId,
        );
        return buildResponse("Feed item favorited", result);
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
    @Delete(":feedItemId")
    async unfavoriteItem(
        @UserId() userId: string,
        @Param("feedItemId", ParseIntPipe) feedItemId: number,
    ) {
        await this.favoriteService.unfavoriteFeedItem(userId, feedItemId);
        return buildResponse("Feed item unfavorited");
    }
}
