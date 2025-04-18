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
import { SubscriptionService } from './subscription.service'

type FeedItemRow = Database['public']['Tables']['feed_items']['Row']
type SubscriptionRow = Database['public']['Tables']['user_subscriptions']['Row']

@ApiTags('Feed')
@ApiBearerAuth()
@Controller({
    path: 'feed',
    version: '1',
})
@UseGuards(SupabaseAuthGuard)
export class FeedController {
    constructor(
        private readonly feedUseCase: FeedUseCaseService,
        private readonly subscriptionService: SubscriptionService,
        private readonly feedItemService: FeedItemService,
    ) {}

    // ユーザーの購読一覧を取得
    @ApiOperation({
        summary: '購読一覧を取得 (ページネーション対応)',
        description:
            'ログインユーザーが登録している購読を、クエリ `page` と `limit` でページネーションして取得します。',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        example: 1,
        description: 'ページ番号 (1 から始まる)',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        example: 100,
        description: '1ページあたりの件数 (最大 100)',
    })
    @ApiOkResponse({
        description: 'PaginatedResult<UserSubscription> 形式で返却します。',
        type: Object,
    })
    @ApiUnauthorizedResponse({ description: '認証エラー (Bearer トークン未設定など)' })
    @Get('subscriptions')
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

    // 新規購読追加
    @ApiOperation({
        summary: '新しい RSS を購読',
        description:
            '送信された feedUrl を解析し、自動で feed_title を設定して購読を作成します。' +
            '同じ URL が既に登録されている場合は 400 を返します。',
    })
    @ApiBody({
        type: AddSubscriptionDto,
        description: '購読追加リクエスト',
        examples: {
            default: { value: { feedUrl: 'https://example.com/rss.xml' } },
        },
    })
    @ApiCreatedResponse({ description: '購読が作成されました' })
    @ApiBadRequestResponse({ description: '無効な URL または重複購読' })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @Post('subscriptions')
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
            return { message: 'Subscription added', data: result }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // 指定の購読を手動Fetch
    @ApiOperation({
        summary: '購読を手動でフェッチ',
        description:
            '指定した購読 ID の RSS を即時取得し、DB に反映します。' +
            'バックグラウンドで重い処理が走るため、完了まで数秒かかる場合があります。',
    })
    @ApiParam({ name: 'id', description: '購読 ID', example: 123 })
    @ApiAcceptedResponse({
        description: 'ジョブを受け付けました (同期実行の場合は 200 で返す実装でも可)',
    })
    @ApiBadRequestResponse({ description: '不正な ID または処理中の例外' })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @Post('subscriptions/:id/fetch')
    async fetchSubscription(
        @SupabaseUser() user: User,
        @Param('id', ParseIntPipe) subscriptionId: number,
    ) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            const result = await this.feedUseCase.fetchFeedItems(subscriptionId, user.id)
            return {
                message: 'Feed fetched successfully',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // 指定の購読に紐づくフィードアイテムを取得
    @ApiOperation({
        summary: '購読のフィードアイテムを取得 (ページネーション対応)',
        description:
            '指定した購読 ID に紐づくフィードアイテムを、`page` と `limit` でページネーションして取得します。',
    })
    @ApiParam({ name: 'id', description: '購読 ID', example: 123 })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        example: 1,
        description: 'ページ番号 (1 から始まる)',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        example: 100,
        description: '1ページあたりの件数 (最大 100)',
    })
    @ApiOkResponse({
        description: 'PaginatedResult<FeedItem> 形式で返却します。',
        type: Object,
    })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @ApiNotFoundResponse({ description: '購読が見つからない場合' })
    @Get('subscriptions/:id/items')
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

    // 購読情報を更新
    @ApiOperation({
        summary: '購読情報を更新',
        description: 'feed_title などのフィールドを部分更新します。',
    })
    @ApiParam({ name: 'id', description: '購読 ID', example: 123 })
    @ApiBody({ type: UpdateSubscriptionDto, description: '更新するフィールド' })
    @ApiOkResponse({ description: '購読が更新されました' })
    @ApiBadRequestResponse({ description: 'バリデーションエラーなど' })
    @ApiNotFoundResponse({ description: '購読が見つからない場合' })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @Patch('subscriptions/:id')
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
            return { message: 'Subscription updated', data: updated }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // 購読を削除
    @ApiOperation({
        summary: '購読を削除',
        description:
            '指定した購読を削除します。関連するフィードアイテムは ON DELETE CASCADE で自動削除されます。',
    })
    @ApiParam({ name: 'id', description: '購読 ID', example: 123 })
    @ApiOkResponse({ description: '購読が削除されました' })
    @ApiBadRequestResponse({ description: '削除時の例外' })
    @ApiNotFoundResponse({ description: '購読が見つからない場合' })
    @ApiUnauthorizedResponse({ description: '認証エラー' })
    @Delete('subscriptions/:id')
    async deleteSubscription(
        @SupabaseUser() user: User,
        @Param('id', ParseIntPipe) subscriptionId: number,
    ) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }

        try {
            await this.subscriptionService.deleteSubscription(user.id, subscriptionId)
            return {
                message: 'Subscription deleted',
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }
}
