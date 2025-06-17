import { Module } from '@nestjs/common'
import { LlmModule } from '../llm/llm.module'
import { SupabaseRequestModule } from '../supabase-request.module'
import { PodcastConfigController } from './application/podcast-config.controller'
import { PodcastConfigService } from './application/podcast-config.service'
import { PodcastEpisodeController } from './application/podcast-episode.controller'
import { PodcastEpisodeMapper } from './application/podcast-episode.mapper'
import { CloudflareR2Service } from './cloudflare-r2.service'
import { PodcastConfigRepository } from './infrastructure/podcast-config.repository'
import { PodcastEpisodeRepository } from './infrastructure/podcast-episode.repository'
import { PodcastTtsService } from './podcast-tts.service'
import { PodcastUploadService } from './podcast-upload.service'
import { PodcastQueueModule } from './queue/podcast-queue.module'

@Module({
    imports: [SupabaseRequestModule, LlmModule, PodcastQueueModule],
    controllers: [PodcastConfigController, PodcastEpisodeController],
    providers: [
        PodcastTtsService,
        PodcastUploadService,
        PodcastConfigService,
        PodcastConfigRepository,
        PodcastEpisodeRepository,
        PodcastEpisodeMapper,
        CloudflareR2Service,
    ],
    exports: [
        PodcastTtsService,
        PodcastUploadService,
        PodcastConfigService,
        PodcastEpisodeRepository,
        PodcastEpisodeMapper,
        CloudflareR2Service,
    ],
})
export class PodcastModule {}
