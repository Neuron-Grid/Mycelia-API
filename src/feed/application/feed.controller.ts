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
    UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { User } from '@supabase/supabase-js'
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard'
import { SupabaseUser } from 'src/auth/supabase-user.decorator'
import { AddSubscriptionDto } from './dto/add-subscription.dto'
import { UpdateSubscriptionDto } from './dto/update-subscription.dto'
import { FeedItemService } from './feed-item.service'
import { FeedUseCaseService } from './feed-usecase.service'
import { SubscriptionService } from './subscription.service'

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
    @ApiOperation({ summary: 'Get all subscriptions for current user' })
    @ApiResponse({ status: 200, description: 'Returns all subscriptions for the user' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
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
    @ApiOperation({ summary: 'Add a new feed subscription' })
    @ApiResponse({ status: 201, description: 'Subscription added successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
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
    @ApiOperation({ summary: 'Manually fetch feed items for a subscription' })
    @ApiParam({ name: 'id', description: 'ID of the subscription to fetch' })
    @ApiResponse({ status: 200, description: 'Feed fetched successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
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
    @ApiOperation({ summary: 'Get feed items for a subscription' })
    @ApiParam({ name: 'id', description: 'ID of the subscription' })
    @ApiResponse({ status: 200, description: 'Feed items fetched successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
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

    // 購読情報を更新
    @ApiOperation({ summary: 'Update a subscription' })
    @ApiParam({ name: 'id', description: 'ID of the subscription to update' })
    @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Patch('subscriptions/:id')
    async updateSubscription(
        @SupabaseUser() user: User,
        @Param('id', ParseIntPipe) subscriptionId: number,
        @Body() dto: UpdateSubscriptionDto,
    ) {
        if (!user?.id) {
            throw new HttpException('No authenticated user ID', HttpStatus.UNAUTHORIZED)
        }

        try {
            const updated = await this.subscriptionService.updateSubscription(
                user.id,
                subscriptionId,
                dto,
            )
            return {
                message: 'Subscription updated',
                data: updated,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // 購読を削除
    @ApiOperation({ summary: 'Delete a subscription' })
    @ApiParam({ name: 'id', description: 'ID of the subscription to delete' })
    @ApiResponse({ status: 200, description: 'Subscription deleted successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
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
