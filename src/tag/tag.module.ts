import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { EmbeddingModule } from "@/embedding/embedding.module";
import { SearchModule } from "@/search/search.module";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { HierarchicalTagService } from "@/tag/application/hierarchical-tag.service";
import { TagController } from "@/tag/application/tag.controller";
import { TagService } from "@/tag/application/tag.service";
import { TagRepository } from "@/tag/infrastructure/tag.repository";

@Module({
    imports: [SupabaseRequestModule, SearchModule, EmbeddingModule, AuthModule],
    controllers: [TagController],
    providers: [TagService, TagRepository, HierarchicalTagService],
    exports: [TagService, HierarchicalTagService],
})
export class TagModule {}
