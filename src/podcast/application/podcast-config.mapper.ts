import { PodcastConfig } from "../domain/podcast-config.entity";
import { PodcastConfigResponseDto } from "./dto/podcast-config.dto";

//  PodcastConfigエンティティとDTOの変換を担うマッパー関数群
export const PodcastConfigMapper = {
    //  PodcastConfigエンティティをレスポンスDTOに変換
    //  @param config PodcastConfig
    //  @returns PodcastConfigResponseDto
    toResponseDto(config: PodcastConfig): PodcastConfigResponseDto {
        return {
            podcastEnabled: config.podcast_enabled,
            podcastScheduleTime: config.podcast_schedule_time,
            podcastLanguage: config.podcast_language,
            updatedAt: config.updated_at,
        };
    },

    //  デフォルトのPodcastConfigResponseDtoを生成
    //  @returns PodcastConfigResponseDto
    createDefaultResponse(): PodcastConfigResponseDto {
        return {
            podcastEnabled: false,
            podcastScheduleTime: null,
            podcastLanguage: "ja-JP",
            updatedAt: new Date().toISOString(),
        };
    },
};
