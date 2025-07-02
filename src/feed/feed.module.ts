import { Module } from '@nestjs/common'
import { SupabaseRequestModule } from 'src/supabase-request.module'
import { EmbeddingModule } from '../embedding/embedding.module'
import { FeedController } from './application/feed.controller'
import { FeedFetchService } from './application/feed-fetch.service'
import { FeedItemService } from './application/feed-item.service'
import { FeedSchedulerService } from './application/feed-scheduler.service'
import { FeedUseCaseService } from './application/feed-usecase.service'
import { SubscriptionService } from './application/subscription.service'
import { FeedItemRepository } from './infrastructure/feed-item.repository'
import { SubscriptionRepository } from './infrastructure/subscription.repository'

@Module({
    imports: [SupabaseRequestModule, EmbeddingModule],
    controllers: [FeedController],
    providers: [
        FeedFetchService,
        FeedItemService,
        FeedSchedulerService,
        FeedUseCaseService,
        SubscriptionService,
        FeedItemRepository,
        SubscriptionRepository,
    ],
})
export class FeedModule {}
