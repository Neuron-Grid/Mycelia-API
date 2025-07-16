import { Injectable } from '@nestjs/common';
import { PodcastEpisodeEntity } from '../domain/podcast-episode.entity';
import { PodcastEpisodeResponseDto } from './dto/podcast-episode.dto';

@Injectable()
export class PodcastEpisodeMapper {
    // エンティティからレスポンスDTOに変換
    toResponseDto(entity: PodcastEpisodeEntity): PodcastEpisodeResponseDto {
        return {
            id: entity.id,
            user_id: entity.user_id,
            summary_id: entity.summary_id,
            title: entity.title,
            audio_url: entity.audio_url,
            soft_deleted: entity.soft_deleted,
            created_at: entity.created_at,
            updated_at: entity.updated_at,
        };
    }

    // 複数のエンティティを一括変換
    toResponseDtoList(entities: PodcastEpisodeEntity[]): PodcastEpisodeResponseDto[] {
        return entities.map((entity) => this.toResponseDto(entity));
    }
}
