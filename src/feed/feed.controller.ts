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
import { FeedService } from './feed.service'

@Controller({
    path: 'feed',
    version: '1',
})
// // すべてのエンドポイントで認証必須
@UseGuards(SupabaseAuthGuard)
export class FeedController {
    constructor(private readonly feedService: FeedService) {}

    // ログインユーザの購読一覧を取得
    @Get('subscriptions')
    async getSubscriptions(@SupabaseUser() user: User) {
        try {
            if (!user?.id) {
                throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
            }
            return await this.feedService.getSubscriptionsByUserId(user.id)
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // 購読を新規追加
    // @param body.feedUrl RSSフィードURL
    @Post('subscriptions')
    async addSubscription(@SupabaseUser() user: User, @Body() body: { feedUrl: string }) {
        try {
            if (!user?.id) {
                throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
            }
            const { feedUrl } = body
            if (!feedUrl) {
                throw new HttpException('feedUrl is required', HttpStatus.BAD_REQUEST)
            }
            const result = await this.feedService.addSubscription(user.id, feedUrl)
            return { message: 'Subscription added', data: result }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    //  指定の購読を手動でRSS取得し、DBに保存
    @Post('subscriptions/:id/fetch')
    async fetchSubscription(
        @SupabaseUser() user: User,
        @Param('id', ParseIntPipe) subscriptionId: number,
    ) {
        try {
            if (!user?.id) {
                throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
            }
            const result = await this.feedService.fetchFeedItems(subscriptionId, user.id)
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
        try {
            if (!user?.id) {
                throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
            }
            const items = await this.feedService.getFeedItems(user.id, subscriptionId)
            return {
                message: 'Feed items fetched',
                data: items,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }
}
