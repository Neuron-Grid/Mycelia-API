import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RedisModule } from '../../shared/redis/redis.module';
import { RedisService } from '../../shared/redis/redis.service';
import { SupabaseRequestModule } from '../../supabase-request.module';
import { PodcastModule } from '../podcast.module';
import { PodcastQueueProcessor } from './podcast-queue.processor';
import { PodcastQueueService } from './podcast-queue.service';

@Module({
    imports: [
        SupabaseRequestModule,
        RedisModule,
        PodcastModule,
        BullModule.registerQueueAsync({
            name: 'podcastQueue',
            imports: [RedisModule],
            // RedisService側で用意した共通ioredisインスタンスを共有する
            useFactory: (redisService: RedisService) => ({
                connection: redisService.createBullClient(),
            }),
            inject: [RedisService],
        }),
    ],
    providers: [PodcastQueueProcessor, PodcastQueueService],
    exports: [PodcastQueueService, BullModule],
})
export class PodcastQueueModule {}
