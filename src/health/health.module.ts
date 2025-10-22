// @file システムヘルスチェックAPIのNestJSモジュール
// @module
// @public
// @since 1.0.0
// @see ./health.controller

import { Module } from "@nestjs/common";
import { AdminRoleGuard } from "@/auth/admin-role.guard";
import { AuthModule } from "@/auth/auth.module";
import { RequiresMfaGuard } from "@/auth/requires-mfa.guard";
import { RedisModule } from "@/shared/redis/redis.module";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { HealthController } from "./health.controller";

@Module({
    imports: [SupabaseRequestModule, RedisModule, AuthModule],
    controllers: [HealthController],
    providers: [RequiresMfaGuard, AdminRoleGuard],
})
export class HealthModule {}
