import type { FeedItemEntity } from "@/feed/domain/feed-item.entity";
import type { Database } from "@/types/schema";
import type { FeedItemDto } from "./dto/feed-item.dto";
import type { FeedItemResponseDto } from "./dto/feed-item-response.dto";

type FeedItemRow = Database["public"]["Tables"]["feed_items"]["Row"];

export const FeedItemMapper = {
    rowToDto(
        row: FeedItemRow,
        extras?: { isFavorite?: boolean; tags?: string[] },
    ): FeedItemDto {
        return {
            id: row.id,
            userSubscriptionId: row.user_subscription_id,
            userId: row.user_id,
            title: row.title,
            link: row.link,
            linkHash: row.link_hash,
            description: row.description,
            publishedAt: row.published_at ?? null,
            titleEmb: row.title_emb,
            softDeleted: row.soft_deleted,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            isFavorite: !!extras?.isFavorite,
            tags: extras?.tags ?? [],
        };
    },
    entityToDto(
        entity: FeedItemEntity | FeedItemResponseDto,
        extras?: { isFavorite?: boolean; tags?: string[] },
    ): FeedItemDto {
        return {
            id: entity.id,
            userSubscriptionId: entity.user_subscription_id,
            userId: entity.user_id,
            title: entity.title,
            link: entity.link,
            linkHash: entity.link_hash,
            description: entity.description,
            publishedAt: entity.published_at
                ? new Date(entity.published_at).toISOString()
                : null,
            titleEmb: entity.title_emb,
            softDeleted: entity.soft_deleted,
            createdAt: new Date(entity.created_at).toISOString(),
            updatedAt: new Date(entity.updated_at).toISOString(),
            isFavorite: !!extras?.isFavorite,
            tags: extras?.tags ?? [],
        };
    },
};
