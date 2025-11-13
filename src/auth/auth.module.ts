import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthAccountDeletionService } from "@/auth/application/auth-account-deletion.service";
import { RequestUserContextService } from "@/auth/application/request-user-context.service";
import { UserVerificationService } from "@/auth/application/user-verification.service";
import { DomainConfigModule } from "@/domain-config/domain-config.module";
import { AuditLogModule } from "@/shared/audit/audit-log.module";
import { DistributedLockModule } from "@/shared/lock/distributed-lock.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { SupabaseAdminModule } from "@/shared/supabase-admin.module";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthRepositoryPort } from "./domain/auth.repository";
import { SupabaseAuthRepository } from "./infrastructure/supabase-auth.repository";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { SupabaseAuthCacheService } from "./supabase-auth-cache.service";
import { SupabaseAuthMetricsService } from "./supabase-auth-metrics.service";
import { WebAuthnService } from "./webauthn.service";

@Module({
    imports: [
        SupabaseRequestModule,
        DomainConfigModule,
        DistributedLockModule,
        RedisModule,
        SupabaseAdminModule,
        AuditLogModule,
        ThrottlerModule.forRoot({
            throttlers: [{ limit: 5, ttl: 60 }],
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        SupabaseAuthGuard,
        SupabaseAuthCacheService,
        SupabaseAuthMetricsService,
        AuthAccountDeletionService,
        WebAuthnService,
        UserVerificationService,
        RequestUserContextService,
        // DI バインディング
        { provide: AuthRepositoryPort, useClass: SupabaseAuthRepository },
    ],
    exports: [
        SupabaseAuthGuard,
        SupabaseAuthCacheService,
        SupabaseAuthMetricsService,
        RequestUserContextService,
        UserVerificationService,
    ],
})
export class AuthModule {}
