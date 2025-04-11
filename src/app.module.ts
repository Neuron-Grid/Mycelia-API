import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { FeedModule } from './feed/feed.module'
import { HealthModule } from './health/health.module'
import { SupabaseRequestModule } from './supabase-request.module'

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
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
