import { Module } from "@nestjs/common";
import { EmbeddingModule } from "@/embedding/embedding.module";
import { SearchModule } from "@/search/search.module";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { HierarchicalTagService } from "@/tag/application/hierarchical-tag.service";
import { TagController } from "@/tag/application/tag.controller";
import { TagService } from "@/tag/application/tag.service";
import { TagRepository } from "@/tag/infrastructure/tag.repository";

@Module({
    imports: [SupabaseRequestModule, SearchModule, EmbeddingModule],
    controllers: [TagController],
    providers: [
        TagService,
        TagRepository,
        HierarchicalTagService,
        SupabaseAdminService,
    ],
    exports: [TagService, HierarchicalTagService],
})
export class TagModule {}
