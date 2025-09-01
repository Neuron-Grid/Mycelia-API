// @file フィード購読・フィードアイテム管理のREST APIコントローラ
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpException,
    HttpStatus,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from "@nestjs/common";
// @see https://docs.nestjs.com/openapi/introduction
import {
    ApiAcceptedResponse,
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiCreatedResponse,
    ApiExtraModels,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
    ApiUnauthorizedResponse,
    getSchemaPath,
} from "@nestjs/swagger";
// @see https://supabase.com/docs/reference/javascript/auth-api
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import { ErrorResponseDto } from "@/common/dto/error-response.dto";
import type { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import type { PaginatedResult } from "@/common/interfaces/paginated-result.interface";
import {
    buildResponse,
    type SuccessResponse,
} from "@/common/utils/response.util";
import { FeedItemService } from "@/feed/application/feed-item.service";
import { FeedUseCaseService } from "@/feed/application/feed-usecase.service";
import { SubscriptionService } from "@/feed/application/subscription.service";
import { AddSubscriptionDto } from "./dto/add-subscription.dto";
import type { FeedItemDto } from "./dto/feed-item.dto";
import { FeedItemResponseDto } from "./dto/feed-item-response.dto";
import type { SubscriptionDto } from "./dto/subscription.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";
import { FeedItemMapper } from "./feed-item.mapper";
import { SubscriptionMapper } from "./subscription.mapper";

// 型注釈はOpenAPIスキーマで表現し、戻り値は共通包形式に統一

@ApiTags("Feed")
@ApiBearerAuth()
@ApiExtraModels(FeedItemResponseDto)
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
    // @param {PaginationQueryDto} query - ページネーション用クエリ
    // @returns {Promise<PaginatedResult<SubscriptionRow>>} - 購読一覧（ページネーション対応）
    // @throws {HttpException} - 認証エラーや取得失敗時
    // @example
    // const result = await feedController.getSubscriptions(user, { page: 1, limit: 10 })
    // @see SubscriptionService.getSubscriptionsPaginated
    @Get()
    @ApiOperation({
        summary: "List subscriptions (paginated)",
        description:
            "Returns the logged-in user's subscriptions paginated by page and limit.",
    })
    @ApiOkResponse({
        description:
            "Returns { message, data: PaginatedResult<UserSubscription> }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "object",
                    properties: {
                        data: { type: "array", items: { type: "object" } },
                        total: { type: "number" },
                        page: { type: "number" },
                        limit: { type: "number" },
                        hasNext: { type: "boolean" },
                    },
                },
            },
        },
    })
    @ApiQuery({
        name: "page",
        required: false,
        type: Number,
        description: "Page number (1-based)",
    })
    @ApiQuery({
        name: "limit",
        required: false,
        type: Number,
        description: "Items per page (max 100)",
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    async getSubscriptions(
        @UserId() userId: string,
        @Query() query: PaginationQueryDto,
    ): Promise<SuccessResponse<PaginatedResult<SubscriptionDto>>> {
        const result = await this.subscriptionService.getSubscriptionsPaginated(
            userId,
            query.page,
            query.limit,
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
    @Post()
    @ApiOperation({
        summary: "Subscribe to a new RSS feed",
        description:
            "Parses the provided feedUrl and auto-sets feed_title; returns 400 if the URL is invalid or already subscribed.",
    })
    @ApiCreatedResponse({
        description: "Returns { message, data }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "object" },
            },
        },
    })
    @ApiBody({ type: AddSubscriptionDto })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @ApiBadRequestResponse({
        description: "Invalid URL or duplicate subscription",
        type: ErrorResponseDto,
    })
    async addSubscription(
        @UserId() userId: string,
        @Body() dto: AddSubscriptionDto,
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
    @Post(":id/fetch")
    @ApiOperation({
        summary: "Fetch subscription now",
        description:
            "Fetches the RSS feed for the specified subscription ID and persists items. Processing may take a few seconds.",
    })
    @ApiAcceptedResponse({
        description: "Returns { message, data }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "object" },
            },
        },
    })
    @ApiParam({ name: "id", type: Number, description: "Subscription ID" })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiNotFoundResponse({
        description: "Subscription not found",
        type: ErrorResponseDto,
    })
    @HttpCode(HttpStatus.ACCEPTED)
    async fetchSubscription(
        @UserId() userId: string,
        @Param("id", ParseIntPipe) subscriptionId: number,
    ) {
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
    // @param {PaginationQueryDto} query - ページネーション用クエリ
    // @returns {Promise<PaginatedResult<FeedItemRow>>} - フィードアイテム一覧（ページネーション対応）
    // @throws {HttpException} - 認証エラーや取得失敗時
    // @example
    // const items = await feedController.getSubscriptionItems(user, 123, { page: 1, limit: 10 })
    // @see FeedItemService.getFeedItemsPaginated
    @Get(":id/items")
    @ApiOperation({
        summary: "List feed items for a subscription (paginated)",
        description:
            "Returns feed items for the specified subscription ID paginated by page and limit.",
    })
    @ApiOkResponse({
        description: "Returns { message, data: PaginatedResult<FeedItem> }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "object",
                    properties: {
                        data: {
                            type: "array",
                            items: { $ref: getSchemaPath(FeedItemResponseDto) },
                        },
                        total: { type: "number" },
                        page: { type: "number" },
                        limit: { type: "number" },
                        hasNext: { type: "boolean" },
                    },
                },
            },
        },
    })
    @ApiParam({ name: "id", type: Number, description: "Subscription ID" })
    @ApiQuery({
        name: "page",
        required: false,
        type: Number,
        description: "Page number (1-based)",
    })
    @ApiQuery({
        name: "limit",
        required: false,
        type: Number,
        description: "Items per page (max 100)",
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiNotFoundResponse({
        description: "Subscription not found",
        type: ErrorResponseDto,
    })
    async getSubscriptionItems(
        @UserId() userId: string,
        @Param("id", ParseIntPipe) subscriptionId: number,
        @Query() query: PaginationQueryDto,
    ): Promise<SuccessResponse<PaginatedResult<FeedItemDto>>> {
        const result = await this.feedItemService.getFeedItemsPaginated(
            userId,
            subscriptionId,
            query.page,
            query.limit,
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
    @Patch(":id")
    @ApiOperation({
        summary: "Update subscription",
        description: "Partially update fields such as feed_title.",
    })
    @ApiOkResponse({
        description: "Returns { message, data }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "object" },
            },
        },
    })
    @ApiParam({ name: "id", type: Number, description: "Subscription ID" })
    @ApiBody({ type: UpdateSubscriptionDto })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @ApiBadRequestResponse({
        description: "Validation error",
        type: ErrorResponseDto,
    })
    @ApiNotFoundResponse({
        description: "Subscription not found",
        type: ErrorResponseDto,
    })
    async updateSubscription(
        @UserId() userId: string,
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: UpdateSubscriptionDto,
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
    @Delete(":id")
    @ApiOperation({
        summary: "Delete subscription",
        description:
            "Deletes the specified subscription. Related feed items are removed via ON DELETE CASCADE.",
    })
    @ApiOkResponse({
        description: "Returns { message, data: null }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "null", nullable: true },
            },
        },
    })
    @ApiParam({ name: "id", type: Number, description: "Subscription ID" })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @ApiBadRequestResponse({
        description: "Deletion error",
        type: ErrorResponseDto,
    })
    @ApiNotFoundResponse({
        description: "Subscription not found",
        type: ErrorResponseDto,
    })
    async deleteSubscription(
        @UserId() userId: string,
        @Param("id", ParseIntPipe) subscriptionId: number,
    ) {
        await this.subscriptionService.deleteSubscription(
            userId,
            subscriptionId,
        );
        return buildResponse("Subscription deleted", null);
    }
}
