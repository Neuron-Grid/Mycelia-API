import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { FavoriteModule } from './favorite/favorite.module'
import { FeedModule } from './feed/feed.module'
import { FeedQueueModule } from './feed/queue/feed-queue.module'
import { HealthModule } from './health/health.module'
import { SupabaseRequestModule } from './supabase-request.module'
import { TagModule } from './tag/tag.module'

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        SupabaseRequestModule,
        // FeedModuleを読み込み
        FeedModule,
        // AuthModule (認証周り)
        AuthModule,
        ScheduleModule.forRoot(),
        HealthModule,
        FeedQueueModule,
        TagModule,
        FavoriteModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
