import {
    Body,
    Controller,
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
import { FeedItemService } from './feed-item.service'
import { FeedUseCaseService } from './feed-usecase.service'
import { SubscriptionService } from './subscription.service'

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
    @Get('subscriptions')
    async getSubscriptions(@SupabaseUser() user: User) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            return await this.subscriptionService.getSubscriptionsByUserId(user.id)
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // 新規購読追加
    @Post('subscriptions')
    async addSubscription(@SupabaseUser() user: User, @Body() body: { feedUrl: string }) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        const { feedUrl } = body
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
    @Get('subscriptions/:id/items')
    async getSubscriptionItems(
        @SupabaseUser() user: User,
        @Param('id', ParseIntPipe) subscriptionId: number,
    ) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }
        try {
            const items = await this.feedItemService.getFeedItems(user.id, subscriptionId)
            return {
                message: 'Feed items fetched',
                data: items,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }
}
