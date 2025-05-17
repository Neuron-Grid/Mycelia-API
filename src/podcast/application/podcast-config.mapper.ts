import { PodcastConfig } from '../domain/podcast-config.entity'
import { PodcastConfigResponseDto } from './dto/podcast-config.dto'

//  PodcastConfigエンティティとDTOの変換を担うマッパー関数群
export const PodcastConfigMapper = {
    //  PodcastConfigエンティティをレスポンスDTOに変換
    //  @param config PodcastConfig
    //  @returns PodcastConfigResponseDto
    toResponseDto(config: PodcastConfig): PodcastConfigResponseDto {
        return {
            podcast_enabled: config.podcast_enabled,
            podcast_schedule_time: config.podcast_schedule_time,
            podcast_language: config.podcast_language,
            updated_at: config.updated_at,
        }
    },

    //  デフォルトのPodcastConfigResponseDtoを生成
    //  @returns PodcastConfigResponseDto
    createDefaultResponse(): PodcastConfigResponseDto {
        return {
            podcast_enabled: false,
            podcast_schedule_time: null,
            podcast_language: 'ja-JP',
            updated_at: new Date().toISOString(),
        }
    },
}
