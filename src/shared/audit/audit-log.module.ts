import { Module } from "@nestjs/common";
import { SupabaseAdminModule } from "@/shared/supabase-admin.module";
import { AuditLogService } from "./audit-log.service";

@Module({
    imports: [SupabaseAdminModule],
    providers: [AuditLogService],
    exports: [AuditLogService],
})
export class AuditLogModule {}
