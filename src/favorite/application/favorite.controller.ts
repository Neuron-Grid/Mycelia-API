// @file お気に入り機能のAPIコントローラ

import { TypedParam, TypedRoute } from "@nestia/core";
import { Controller, UseGuards } from "@nestjs/common";
// @see https://docs.nestjs.com/openapi/introduction

// @see https://supabase.com/docs/reference/javascript/auth-api
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import { buildResponse, SuccessResponse } from "@/common/utils/response.util";
import { parseUInt32 } from "@/common/utils/typed-param";
import { CheckFavoriteResponseDto } from "@/favorite/application/dto/check-favorite-response.dto";
import { FavoriteDto } from "@/favorite/application/dto/favorite.dto";
import { FavoriteMapper } from "./favorite.mapper";
import { FavoriteService } from "./favorite.service";

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
    /** Favorites list */
    @TypedRoute.Get("")
    async getUserFavorites(
        @UserId() userId: string,
    ): Promise<SuccessResponse<FavoriteDto[]>> {
        const favorites = await this.favoriteService.getUserFavorites(userId);
        return buildResponse(
            "Favorites fetched",
            FavoriteMapper.listToDto(favorites),
        );
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
    /** Favorite check */
    @TypedRoute.Get(":feedItemId/is-favorited")
    async checkFavorite(
        @UserId() userId: string,
        @TypedParam("feedItemId", parseUInt32) feedItemId: number,
    ): Promise<SuccessResponse<CheckFavoriteResponseDto>> {
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
    /** Favorite a feed item */
    @TypedRoute.Post(":feedItemId")
    async favoriteItem(
        @UserId() userId: string,
        @TypedParam("feedItemId", parseUInt32) feedItemId: number,
    ): Promise<SuccessResponse<FavoriteDto>> {
        const result = await this.favoriteService.favoriteFeedItem(
            userId,
            feedItemId,
        );
        return buildResponse(
            "Feed item favorited",
            FavoriteMapper.rowToDto(result),
        );
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
    /** Unfavorite a feed item */
    @TypedRoute.Delete(":feedItemId")
    async unfavoriteItem(
        @UserId() userId: string,
        @TypedParam("feedItemId", parseUInt32) feedItemId: number,
    ): Promise<SuccessResponse<null>> {
        await this.favoriteService.unfavoriteFeedItem(userId, feedItemId);
        return buildResponse("Feed item unfavorited", null);
    }
}
