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
import {
    ApiBearerAuth,
    ApiExtraModels,
    ApiOkResponse,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from "@nestjs/swagger";
// @see https://supabase.com/docs/reference/javascript/auth-api
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import { buildResponse, SuccessResponse } from "@/common/utils/response.util";
import { CheckFavoriteResponseDto } from "@/favorite/application/dto/check-favorite-response.dto";
import { FavoriteDto } from "@/favorite/application/dto/favorite.dto";
import { FavoriteMapper } from "./favorite.mapper";
import { FavoriteService } from "./favorite.service";

@ApiTags("Favorites")
@ApiBearerAuth()
@Controller({
    path: "favorites",
    version: "1",
})
@UseGuards(SupabaseAuthGuard)
@ApiExtraModels(FavoriteDto, CheckFavoriteResponseDto)
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
    @ApiOkResponse({
        description: "Favorites list",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "array",
                    items: { $ref: getSchemaPath(FavoriteDto) },
                },
            },
        },
    })
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
    @Get(":feedItemId/is-favorited")
    @ApiOkResponse({
        description: "Favorite check",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { $ref: getSchemaPath(CheckFavoriteResponseDto) },
            },
        },
    })
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
    @ApiResponse({
        status: 201,
        description: "Favorited successfully",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { $ref: getSchemaPath(FavoriteDto) },
            },
        },
    })
    async favoriteItem(
        @UserId() userId: string,
        @Param("feedItemId", ParseIntPipe) feedItemId: number,
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
    @Delete(":feedItemId")
    @ApiOkResponse({
        description: "Unfavorited successfully",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { nullable: true, type: "null" },
            },
        },
    })
    async unfavoriteItem(
        @UserId() userId: string,
        @Param("feedItemId", ParseIntPipe) feedItemId: number,
    ) {
        await this.favoriteService.unfavoriteFeedItem(userId, feedItemId);
        return buildResponse("Feed item unfavorited", null);
    }
}
