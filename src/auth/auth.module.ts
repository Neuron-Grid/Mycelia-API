import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { DomainConfigModule } from "@/domain-config/domain-config.module";
import { DistributedLockModule } from "@/shared/lock/distributed-lock.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthRepositoryPort } from "./domain/auth.repository";
import { SupabaseAuthRepository } from "./infrastructure/supabase-auth.repository";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { WebAuthnService } from "./webauthn.service";

@Module({
    imports: [
        SupabaseRequestModule,
        ConfigModule,
        DomainConfigModule,
        DistributedLockModule,
        RedisModule,
        ThrottlerModule.forRoot({
            throttlers: [{ limit: 5, ttl: 60 }],
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        SupabaseAuthGuard,
        SupabaseAdminService,
        WebAuthnService,
        // DI バインディング
        { provide: AuthRepositoryPort, useClass: SupabaseAuthRepository },
    ],
})
export class AuthModule {}
