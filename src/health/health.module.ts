// @file システムヘルスチェックAPIのNestJSモジュール
// @module
// @public
// @since 1.0.0
// @see ./health.controller

import { Module } from "@nestjs/common";
import { AdminRoleGuard } from "@/auth/admin-role.guard";
import { RequiresMfaGuard } from "@/auth/requires-mfa.guard";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { RedisModule } from "@/shared/redis/redis.module";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { HealthController } from "./health.controller";

@Module({
    imports: [SupabaseRequestModule, RedisModule],
    controllers: [HealthController],
    providers: [
        SupabaseAdminService,
        SupabaseAuthGuard,
        RequiresMfaGuard,
        AdminRoleGuard,
    ],
})
export class HealthModule {}
