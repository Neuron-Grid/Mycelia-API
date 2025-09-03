// @file フィード購読・フィードアイテム管理のREST APIコントローラ

import { TypedBody, TypedParam, TypedQuery, TypedRoute } from "@nestia/core";
import {
    Controller,
    HttpCode,
    HttpException,
    HttpStatus,
    UseGuards,
} from "@nestjs/common";
// @see https://docs.nestjs.com/openapi/introduction

// @see https://supabase.com/docs/reference/javascript/auth-api
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import type { PaginatedResult } from "@/common/interfaces/paginated-result.interface";
import {
    buildResponse,
    type SuccessResponse,
} from "@/common/utils/response.util";
import { parseUInt32 } from "@/common/utils/typed-param";
import { FeedItemService } from "@/feed/application/feed-item.service";
import { FeedUseCaseService } from "@/feed/application/feed-usecase.service";
import { SubscriptionService } from "@/feed/application/subscription.service";
import { AddSubscriptionDto } from "./dto/add-subscription.dto";
import type { FeedItemDto } from "./dto/feed-item.dto";
// import removed: FeedItemResponseDto only used for @nestjs/swagger
import type { SubscriptionDto } from "./dto/subscription.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";
import { FeedItemMapper } from "./feed-item.mapper";
import { SubscriptionMapper } from "./subscription.mapper";

// 型注釈はOpenAPIスキーマで表現し、戻り値は共通包形式に統一

@Controller({
    path: "feed",
    version: "1",
})
@UseGuards(SupabaseAuthGuard)
// @public
// @since 1.0.0
export class FeedController {
    // @param {FeedUseCaseService} feedUseCase - フィードユースケースサービス
    // @param {SubscriptionService} subscriptionService - 購読サービス
    // @param {FeedItemService} feedItemService - フィードアイテムサービス
    // @since 1.0.0
    // @public
    constructor(
        private readonly feedUseCase: FeedUseCaseService,
        private readonly subscriptionService: SubscriptionService,
        private readonly feedItemService: FeedItemService,
    ) {}

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} page - ページ番号
    // @param {number} limit - 件数上限
    // @returns {Promise<PaginatedResult<SubscriptionRow>>} - 購読一覧（ページネーション対応）
    // @throws {HttpException} - 認証エラーや取得失敗時
    // @example
    // const result = await feedController.getSubscriptions(user, { page: 1, limit: 10 })
    // @see SubscriptionService.getSubscriptionsPaginated
    /** List subscriptions (paginated) */
    @TypedRoute.Get("")
    async getSubscriptions(
        @UserId() userId: string,
        @TypedQuery<{ page?: number; limit?: number }>()
        q: { page?: number; limit?: number },
    ): Promise<SuccessResponse<PaginatedResult<SubscriptionDto>>> {
        const page = q?.page ?? 1;
        const limit = q?.limit ?? 100;
        const result = await this.subscriptionService.getSubscriptionsPaginated(
            userId,
            page,
            limit,
        );
        return buildResponse("Subscriptions fetched", {
            ...result,
            data: SubscriptionMapper.listToDto(result.data),
        });
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {AddSubscriptionDto} dto - 購読追加リクエストDTO
    // @returns {Promise<unknown>} - 追加結果
    // @throws {HttpException} - 認証エラーや追加失敗時
    // @example
    // await feedController.addSubscription(user, { feedUrl: 'https://example.com/rss.xml' })
    // @see SubscriptionService.addSubscription
    /** Subscribe to a new RSS feed */
    @TypedRoute.Post("")
    async addSubscription(
        @UserId() userId: string,
        @TypedBody() dto: AddSubscriptionDto,
    ): Promise<SuccessResponse<SubscriptionDto>> {
        const { feedUrl } = dto;
        if (!feedUrl) {
            throw new HttpException(
                "feedUrl is required",
                HttpStatus.BAD_REQUEST,
            );
        }

        // RSSタイトルの取得（パース失敗時は空文字でもOK）
        let feedTitle = "";
        try {
            const feedData = await this.feedUseCase.fetchFeedMeta(feedUrl);
            feedTitle = (feedData.meta.title ?? "").substring(0, 100);
        } catch {
            // パース失敗しても購読は続行
            feedTitle = "";
        }

        const result = await this.subscriptionService.addSubscription(
            userId,
            feedUrl,
            feedTitle,
        );
        return buildResponse(
            "Subscription added",
            SubscriptionMapper.rowToDto(result),
        );
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} subscriptionId - 購読ID
    // @returns {Promise<unknown>} - フィード取得結果
    // @throws {HttpException} - 認証エラーや取得失敗時
    // @example
    // await feedController.fetchSubscription(user, 123)
    // @see FeedUseCaseService.fetchFeedItems
    /** Fetch subscription now */
    @TypedRoute.Post(":id/fetch")
    @HttpCode(HttpStatus.ACCEPTED)
    async fetchSubscription(
        @UserId() userId: string,
        @TypedParam("id", parseUInt32) subscriptionId: number,
    ): Promise<SuccessResponse<Record<string, unknown>>> {
        const result = await this.feedUseCase.fetchFeedItems(
            subscriptionId,
            userId,
        );
        return buildResponse("Feed fetched successfully", result);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} subscriptionId - 購読ID
    // @param {number} page - ページ番号
    // @param {number} limit - 件数上限
    // @returns {Promise<PaginatedResult<FeedItemRow>>} - フィードアイテム一覧（ページネーション対応）
    // @throws {HttpException} - 認証エラーや取得失敗時
    // @example
    // const items = await feedController.getSubscriptionItems(user, 123, { page: 1, limit: 10 })
    // @see FeedItemService.getFeedItemsPaginated
    /** List feed items for a subscription (paginated) */
    @TypedRoute.Get(":id/items")
    async getSubscriptionItems(
        @UserId() userId: string,
        @TypedParam("id", parseUInt32) subscriptionId: number,
        @TypedQuery<{ page?: number; limit?: number }>()
        q: { page?: number; limit?: number },
    ): Promise<SuccessResponse<PaginatedResult<FeedItemDto>>> {
        const page = q?.page ?? 1;
        const limit = q?.limit ?? 100;
        const result = await this.feedItemService.getFeedItemsPaginated(
            userId,
            subscriptionId,
            page,
            limit,
        );
        return buildResponse("Feed items fetched", {
            ...result,
            data: result.data.map((it) =>
                FeedItemMapper.entityToDto(it, {
                    isFavorite: it.isFavorite,
                    tags: it.tags,
                }),
            ),
        });
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} id - 購読ID
    // @param {UpdateSubscriptionDto} dto - 更新内容DTO
    // @returns {Promise<unknown>} - 更新結果
    // @throws {HttpException} - 認証エラーや更新失敗時
    // @example
    // await feedController.updateSubscription(user, 123, { feedTitle: '新タイトル' })
    // @see SubscriptionService.updateSubscription
    /** Update subscription (partial) */
    @TypedRoute.Patch(":id")
    async updateSubscription(
        @UserId() userId: string,
        @TypedParam("id", parseUInt32) id: number,
        @TypedBody() dto: UpdateSubscriptionDto,
    ): Promise<SuccessResponse<SubscriptionDto>> {
        const updated = await this.subscriptionService.updateSubscription(
            userId,
            id,
            dto,
        );
        return buildResponse(
            "Subscription updated",
            SubscriptionMapper.rowToDto(updated),
        );
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} subscriptionId - 購読ID
    // @returns {Promise<unknown>} - 削除結果
    // @throws {HttpException} - 認証エラーや削除失敗時
    // @example
    // await feedController.deleteSubscription(user, 123)
    // @see SubscriptionService.deleteSubscription
    /** Delete subscription */
    @TypedRoute.Delete(":id")
    async deleteSubscription(
        @UserId() userId: string,
        @TypedParam("id", parseUInt32) subscriptionId: number,
    ): Promise<SuccessResponse<null>> {
        await this.subscriptionService.deleteSubscription(
            userId,
            subscriptionId,
        );
        return buildResponse("Subscription deleted", null);
    }
}
