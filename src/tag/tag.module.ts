import { Module } from '@nestjs/common'
import { SearchModule } from 'src/search/search.module'
import { SupabaseRequestModule } from 'src/supabase-request.module'
import { HierarchicalTagService } from './application/hierarchical-tag.service'
import { TagController } from './application/tag.controller'
import { TagService } from './application/tag.service'
import { TagRepository } from './infrastructure/tag.repository'

@Module({
    imports: [SupabaseRequestModule, SearchModule],
    controllers: [TagController],
    providers: [TagService, TagRepository, HierarchicalTagService],
    exports: [TagService, HierarchicalTagService],
})
export class TagModule {}
