import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DomainConfigModule } from 'src/domain-config/domain-config.module'
import { SupabaseRequestModule } from 'src/supabase-request.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { SupabaseAuthGuard } from './supabase-auth.guard'

@Module({
    imports: [
        // 各リクエストスコープでSupabaseClientを生成
        SupabaseRequestModule,
        // 環境変数を使うためにConfigModuleを読み込む
        ConfigModule,
        DomainConfigModule,
    ],
    // コントローラはAuthControllerのみ
    controllers: [AuthController],
    // ガードはサービスと同様にprovidersへ
    providers: [AuthService, SupabaseAuthGuard],
})
export class AuthModule {}
