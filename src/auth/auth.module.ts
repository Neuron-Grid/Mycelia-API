import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DomainConfigModule } from "@/domain-config/domain-config.module";
import { DistributedLockModule } from "@/shared/lock/distributed-lock.module";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthRepositoryPort } from "./domain/auth.repository";
import { SupabaseAuthRepository } from "./infrastructure/supabase-auth.repository";
import { SupabaseAuthGuard } from "./supabase-auth.guard";

@Module({
    imports: [
        SupabaseRequestModule,
        ConfigModule,
        DomainConfigModule,
        DistributedLockModule,
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        SupabaseAuthGuard,
        SupabaseAdminService,
        // DI バインディング
        { provide: AuthRepositoryPort, useClass: SupabaseAuthRepository },
    ],
})
export class AuthModule {}
