import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SupabaseAdminService } from "./supabase-admin.service";

@Global()
@Module({
    imports: [ConfigModule],
    providers: [SupabaseAdminService],
    exports: [SupabaseAdminService],
})
export class SupabaseAdminModule {}
