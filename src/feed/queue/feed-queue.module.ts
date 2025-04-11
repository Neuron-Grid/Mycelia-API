import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { SupabaseRequestModule } from 'src/supabase-request.module'
import { FeedFetchService } from '../application/feed-fetch.service'
import { FeedItemService } from '../application/feed-item.service'
import { FeedUseCaseService } from '../application/feed-usecase.service'
import { SubscriptionService } from '../application/subscription.service'
import { FeedItemRepository } from '../infrastructure/feed-item.repository'
import { SubscriptionRepository } from '../infrastructure/subscription.repository'
import { FeedQueueProcessor } from './feed-queue.processor'
import { FeedQueueService } from './feed-queue.service'

@Module({
    imports: [
        ConfigModule,
        SupabaseRequestModule,
        BullModule.registerQueueAsync({
            name: 'feedQueue',
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                redis: {
                    host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
                    port: configService.get<number>('REDIS_PORT', 6379),
                    // password など必要に応じて設定
                },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [
        // Bull
        // Processor
        FeedQueueProcessor,
        // キュー操作用サービス
        FeedQueueService,
        // 既存のFeedモジュール関連
        FeedUseCaseService,
        SubscriptionService,
        FeedItemService,
        FeedFetchService,
        SubscriptionRepository,
        FeedItemRepository,
    ],
    exports: [FeedQueueService],
})
export class FeedQueueModule {}
