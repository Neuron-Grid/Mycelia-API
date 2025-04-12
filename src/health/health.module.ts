import { Module } from '@nestjs/common'
import { FeedQueueModule } from 'src/feed/queue/feed-queue.module'
import { SupabaseRequestModule } from 'src/supabase-request.module'
import { HealthController } from './health.controller'

@Module({
    imports: [SupabaseRequestModule, FeedQueueModule],
    controllers: [HealthController],
})
export class HealthModule {}
