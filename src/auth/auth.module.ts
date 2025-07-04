import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DomainConfigModule } from 'src/domain-config/domain-config.module'
import { DistributedLockModule } from 'src/shared/lock/distributed-lock.module'
import { SupabaseRequestModule } from 'src/supabase-request.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthRepositoryPort } from './domain/auth.repository'
import { SupabaseAuthRepository } from './infrastructure/supabase-auth.repository'
import { SupabaseAuthGuard } from './supabase-auth.guard'

@Module({
    imports: [SupabaseRequestModule, ConfigModule, DomainConfigModule, DistributedLockModule],
    controllers: [AuthController],
    providers: [
        AuthService,
        SupabaseAuthGuard,
        // DI バインディング
        { provide: AuthRepositoryPort, useClass: SupabaseAuthRepository },
    ],
})
export class AuthModule {}
