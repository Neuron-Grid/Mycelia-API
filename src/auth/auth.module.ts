import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SupabaseRequestModule } from 'src/supabase-request.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
    imports: [
        // SupabaseRequestModuleは各リクエストスコープでSupabaseClientを生成
        SupabaseRequestModule,

        // 環境変数を使うためにConfigModuleを読み込む
        ConfigModule,
    ],
    providers: [AuthService],
    controllers: [AuthController],
})
export class AuthModule {}
