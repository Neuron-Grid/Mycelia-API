import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SupabaseAdminModule } from "@/shared/supabase-admin.module";
import { StorageManagementService } from "./application/storage-management.service";

@Module({
    imports: [ConfigModule, SupabaseAdminModule],
    providers: [StorageManagementService],
    exports: [StorageManagementService],
})
export class StorageModule {}
