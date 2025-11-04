import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SupabaseAdminModule } from "@/shared/supabase-admin.module";
import { AuditLogService } from "./audit-log.service";

@Module({
    imports: [ConfigModule, SupabaseAdminModule],
    providers: [AuditLogService],
    exports: [AuditLogService],
})
export class AuditLogModule {}
