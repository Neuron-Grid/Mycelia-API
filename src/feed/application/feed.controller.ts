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
} from '@nestjs/common'
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
} from '@nestjs/swagger'
// @see https://supabase.com/docs/reference/javascript/auth-api
import { User } from '@supabase/supabase-js'
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard'
import { SupabaseUser } from 'src/auth/supabase-user.decorator'
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto'
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface'
import { Database } from 'src/types/schema'
import { AddSubscriptionDto } from './dto/add-subscription.dto'
import { UpdateSubscriptionDto } from './dto/update-subscription.dto'
import { FeedItemService } from './feed-item.service'
import { FeedUseCaseService } from './feed-usecase.service'
import { buildResponse } from './response.util'
import { SubscriptionService } from './subscription.service'

// @typedef {Database['public']['Tables']['feed_items']['Row']} FeedItemRow - フィードアイテムの型
type FeedItemRow = Database['public']['Tables']['feed_items']['Row']
// @typedef {Database['public']['Tables']['user_subscriptions']['Row']} SubscriptionRow - 購読の型
type SubscriptionRow = Database['public']['Tables']['user_subscriptions']['Row']

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
    async getSubscriptions(
        @SupabaseUser() user: User,
        @Query() query: PaginationQueryDto,
    ): Promise<PaginatedResult<SubscriptionRow>> {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            return await this.subscriptionService.getSubscriptionsPaginated(
                user.id,
                query.page,
                query.limit,
            )
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {AddSubscriptionDto} dto - 購読追加リクエストDTO
    // @returns {Promise<any>} - 追加結果
    // @throws {HttpException} - 認証エラーや追加失敗時
    // @example
    // await feedController.addSubscription(user, { feedUrl: 'https://example.com/rss.xml' })
    // @see SubscriptionService.addSubscription
    async addSubscription(@SupabaseUser() user: User, @Body() dto: AddSubscriptionDto) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        const { feedUrl } = dto
        if (!feedUrl) {
            throw new HttpException('feedUrl is required', HttpStatus.BAD_REQUEST)
        }

        // RSSタイトルの取得（パース失敗時は空文字でもOK）
        let feedTitle = ''
        try {
            const feedData = await this.feedUseCase.fetchFeedMeta(feedUrl)
            feedTitle = (feedData.meta.title ?? '').substring(0, 100)
        } catch {
            // パース失敗しても購読は続行
            feedTitle = ''
        }

        try {
            const result = await this.subscriptionService.addSubscription(
                user.id,
                feedUrl,
                feedTitle,
            )
            return buildResponse('Subscription added', result)
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} subscriptionId - 購読ID
    // @returns {Promise<any>} - フィード取得結果
    // @throws {HttpException} - 認証エラーや取得失敗時
    // @example
    // await feedController.fetchSubscription(user, 123)
    // @see FeedUseCaseService.fetchFeedItems
    async fetchSubscription(
        @SupabaseUser() user: User,
        @Param('id', ParseIntPipe) subscriptionId: number,
    ) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            const result = await this.feedUseCase.fetchFeedItems(subscriptionId, user.id)
            return buildResponse('Feed fetched successfully', result)
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
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
    async getSubscriptionItems(
        @SupabaseUser() user: User,
        @Param('id', ParseIntPipe) subscriptionId: number,
        @Query() query: PaginationQueryDto,
    ): Promise<PaginatedResult<FeedItemRow>> {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            return await this.feedItemService.getFeedItemsPaginated(
                user.id,
                subscriptionId,
                query.page,
                query.limit,
            )
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} id - 購読ID
    // @param {UpdateSubscriptionDto} dto - 更新内容DTO
    // @returns {Promise<any>} - 更新結果
    // @throws {HttpException} - 認証エラーや更新失敗時
    // @example
    // await feedController.updateSubscription(user, 123, { feedTitle: '新タイトル' })
    // @see SubscriptionService.updateSubscription
    async updateSubscription(
        @SupabaseUser() user: User,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateSubscriptionDto,
    ) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            const updated = await this.subscriptionService.updateSubscription(user.id, id, dto)
            return buildResponse('Subscription updated', updated)
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - Supabase認証ユーザー
    // @param {number} subscriptionId - 購読ID
    // @returns {Promise<any>} - 削除結果
    // @throws {HttpException} - 認証エラーや削除失敗時
    // @example
    // await feedController.deleteSubscription(user, 123)
    // @see SubscriptionService.deleteSubscription
    async deleteSubscription(
        @SupabaseUser() user: User,
        @Param('id', ParseIntPipe) subscriptionId: number,
    ) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }

        try {
            await this.subscriptionService.deleteSubscription(user.id, subscriptionId)
            return buildResponse('Subscription deleted')
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }
}
