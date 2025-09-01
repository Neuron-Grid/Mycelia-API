import { Injectable } from "@nestjs/common";
import { PodcastEpisodeEntity } from "../domain/podcast-episode.entity";
import { PodcastEpisodeResponseDto } from "./dto/podcast-episode.dto";

@Injectable()
export class PodcastEpisodeMapper {
    // エンティティからレスポンスDTOに変換
    toResponseDto(entity: PodcastEpisodeEntity): PodcastEpisodeResponseDto {
        return {
            id: entity.id,
            userId: entity.user_id,
            summaryId: entity.summary_id,
            title: entity.title,
            audioUrl: entity.audio_url,
            softDeleted: entity.soft_deleted,
            createdAt: entity.created_at,
            updatedAt: entity.updated_at,
        };
    }

    // 複数のエンティティを一括変換
    toResponseDtoList(
        entities: PodcastEpisodeEntity[],
    ): PodcastEpisodeResponseDto[] {
        return entities.map((entity) => this.toResponseDto(entity));
    }
}
