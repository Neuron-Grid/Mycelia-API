import { Module } from "@nestjs/common";
import { SupabaseAdminModule } from "@/shared/supabase-admin.module";
import { StorageManagementService } from "./application/storage-management.service";

@Module({
    imports: [SupabaseAdminModule],
    providers: [StorageManagementService],
    exports: [StorageManagementService],
})
export class StorageModule {}
