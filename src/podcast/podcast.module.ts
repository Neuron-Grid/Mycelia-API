import { Module } from '@nestjs/common'
import { SupabaseRequestModule } from '../supabase-request.module'
import { PodcastConfigController } from './application/podcast-config.controller'
import { PodcastConfigService } from './application/podcast-config.service'
import { CloudflareR2Service } from './cloudflare-r2.service'
import { PodcastConfigRepository } from './infrastructure/podcast-config.repository'
import { PodcastTtsService } from './podcast-tts.service'
import { PodcastUploadService } from './podcast-upload.service'

@Module({
    imports: [SupabaseRequestModule],
    controllers: [PodcastConfigController],
    providers: [
        PodcastTtsService,
        PodcastUploadService,
        PodcastConfigService,
        PodcastConfigRepository,
        CloudflareR2Service,
    ],
    exports: [PodcastTtsService, PodcastUploadService, PodcastConfigService],
})
export class PodcastModule {}
