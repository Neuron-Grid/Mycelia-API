// @file フィード購読・フィードアイテム管理のREST APIコントローラ
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
// @see https://docs.nestjs.com/openapi/introduction
import {
    ApiAcceptedResponse,
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
// @see https://supabase.com/docs/reference/javascript/auth-api
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard';
import { UserId } from 'src/auth/user-id.decorator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { Database } from '../../types/schema';
import { AddSubscriptionDto } from './dto/add-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { FeedItemService } from './feed-item.service';
import { FeedUseCaseService } from './feed-usecase.service';
import { buildResponse } from './response.util';
import { SubscriptionService } from './subscription.service';

// @typedef {Database['public']['Tables']['feed_items']['Row']} FeedItemRow - フィードアイテムの型
type FeedItemRow = Database['public']['Tables']['feed_items']['Row'];
// @typedef {Database['public']['Tables']['user_subscriptions']['Row']} SubscriptionRow - 購読の型
type SubscriptionRow = Database['public']['Tables']['user_subscriptions']['Row'];

@ApiTags('Feed')
@ApiBearerAuth()
@Controller({
    path: 'feed',
    version: '1',
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
    @ApiOperation({ summary: 'ユーザーの購読一覧を取得' })
    @ApiOkResponse({ description: '購読一覧取得成功' })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'ページ番号',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: '1ページあたりの件数',
    })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @ApiBadRequestResponse({ description: '取得失敗' })
    async getSubscriptions(
        @UserId() userId: string,
        @Query() query: PaginationQueryDto,
    ): Promise<PaginatedResult<SubscriptionRow>> {
        return await this.subscriptionService.getSubscriptionsPaginated(
            userId,
            query.page,
            query.limit,
        );
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
    @ApiOperation({ summary: 'RSS購読を追加' })
    @ApiCreatedResponse({ description: '購読追加成功' })
    @ApiBody({ type: AddSubscriptionDto })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @ApiBadRequestResponse({ description: '追加失敗' })
    async addSubscription(@UserId() userId: string, @Body() dto: AddSubscriptionDto) {
        const { feedUrl } = dto;
        if (!feedUrl) {
            throw new HttpException('feedUrl is required', HttpStatus.BAD_REQUEST);
        }

        // RSSタイトルの取得（パース失敗時は空文字でもOK）
        let feedTitle = '';
        try {
            const feedData = await this.feedUseCase.fetchFeedMeta(feedUrl);
            feedTitle = (feedData.meta.title ?? '').substring(0, 100);
        } catch {
            // パース失敗しても購読は続行
            feedTitle = '';
        }

        const result = await this.subscriptionService.addSubscription(userId, feedUrl, feedTitle);
        return buildResponse('Subscription added', result);
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
    @Post(':id/fetch')
    @ApiOperation({ summary: '指定した購読のフィードを手動取得' })
    @ApiAcceptedResponse({ description: 'フィード取得開始' })
    @ApiParam({ name: 'id', type: Number, description: '購読ID' })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @ApiBadRequestResponse({ description: '取得失敗' })
    @ApiNotFoundResponse({ description: '購読が見つかりません' })
    async fetchSubscription(
        @UserId() userId: string,
        @Param('id', ParseIntPipe) subscriptionId: number,
    ) {
        const result = await this.feedUseCase.fetchFeedItems(subscriptionId, userId);
        return buildResponse('Feed fetched successfully', result);
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
    @Get(':id/items')
    @ApiOperation({ summary: '購読のフィードアイテム一覧を取得' })
    @ApiOkResponse({ description: 'フィードアイテム一覧取得成功' })
    @ApiParam({ name: 'id', type: Number, description: '購読ID' })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'ページ番号',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: '1ページあたりの件数',
    })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @ApiBadRequestResponse({ description: '取得失敗' })
    @ApiNotFoundResponse({ description: '購読が見つかりません' })
    async getSubscriptionItems(
        @UserId() userId: string,
        @Param('id', ParseIntPipe) subscriptionId: number,
        @Query() query: PaginationQueryDto,
    ): Promise<PaginatedResult<FeedItemRow>> {
        return await this.feedItemService.getFeedItemsPaginated(
            userId,
            subscriptionId,
            query.page,
            query.limit,
        );
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
    @Patch(':id')
    @ApiOperation({ summary: '購読情報を更新' })
    @ApiOkResponse({ description: '購読更新成功' })
    @ApiParam({ name: 'id', type: Number, description: '購読ID' })
    @ApiBody({ type: UpdateSubscriptionDto })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @ApiBadRequestResponse({ description: '更新失敗' })
    @ApiNotFoundResponse({ description: '購読が見つかりません' })
    async updateSubscription(
        @UserId() userId: string,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateSubscriptionDto,
    ) {
        const updated = await this.subscriptionService.updateSubscription(userId, id, dto);
        return buildResponse('Subscription updated', updated);
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
    @Delete(':id')
    @ApiOperation({ summary: '購読を削除' })
    @ApiOkResponse({ description: '購読削除成功' })
    @ApiParam({ name: 'id', type: Number, description: '購読ID' })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @ApiBadRequestResponse({ description: '削除失敗' })
    @ApiNotFoundResponse({ description: '購読が見つかりません' })
    async deleteSubscription(
        @UserId() userId: string,
        @Param('id', ParseIntPipe) subscriptionId: number,
    ) {
        await this.subscriptionService.deleteSubscription(userId, subscriptionId);
        return buildResponse('Subscription deleted');
    }
}
