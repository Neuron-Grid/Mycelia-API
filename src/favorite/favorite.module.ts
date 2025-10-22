import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { FavoriteController } from "./application/favorite.controller";
import { FavoriteService } from "./application/favorite.service";
import { FavoriteRepository } from "./infrastructure/favorite.repository";

@Module({
    imports: [SupabaseRequestModule, AuthModule],
    controllers: [FavoriteController],
    providers: [FavoriteService, FavoriteRepository],
    exports: [FavoriteService],
})
export class FavoriteModule {}
