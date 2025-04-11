import { Module } from '@nestjs/common'
import { SupabaseRequestModule } from 'src/supabase-request.module'
import { FeedFetchService } from './application/feed-fetch.service'
import { FeedItemService } from './application/feed-item.service'
import { FeedUseCaseService } from './application/feed-usecase.service'
import { FeedController } from './application/feed.controller'
import { SubscriptionService } from './application/subscription.service'
import { FeedItemRepository } from './infrastructure/feed-item.repository'
import { SubscriptionRepository } from './infrastructure/subscription.repository'

@Module({
    imports: [SupabaseRequestModule],
    controllers: [FeedController],
    providers: [
        // Application 層
        FeedFetchService,
        FeedItemService,
        FeedUseCaseService,
        SubscriptionService,
        // Infrastructure 層
        FeedItemRepository,
        SubscriptionRepository,
    ],
})
export class FeedModule {}
