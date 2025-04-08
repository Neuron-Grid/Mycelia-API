import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { SupabaseRequestModule } from './supabase-request.module'

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true }), SupabaseRequestModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
