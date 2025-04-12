import { Module } from '@nestjs/common'
import { SupabaseRequestModule } from 'src/supabase-request.module'
import { TagController } from './application/tag.controller'
import { TagService } from './application/tag.service'
import { TagRepository } from './infrastructure/tag.repository'

@Module({
    imports: [SupabaseRequestModule],
    controllers: [TagController],
    providers: [TagService, TagRepository],
    exports: [TagService],
})
export class TagModule {}
