import { FeedItemEntity } from "../../domain/feed-item.entity";

export class FeedItemResponseDto extends FeedItemEntity {
    isFavorite: boolean;
    tags: string[];
}
