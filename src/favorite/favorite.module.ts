import { Module } from "@nestjs/common";
import { SupabaseAdminService } from "src/shared/supabase-admin.service";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { FavoriteController } from "./application/favorite.controller";
import { FavoriteService } from "./application/favorite.service";
import { FavoriteRepository } from "./infrastructure/favorite.repository";

@Module({
    imports: [SupabaseRequestModule],
    controllers: [FavoriteController],
    providers: [FavoriteService, FavoriteRepository, SupabaseAdminService],
    exports: [FavoriteService],
})
export class FavoriteModule {}
