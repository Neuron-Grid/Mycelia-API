import { TagEntity } from "@/tag/domain/tag.entity";
import { Database } from "@/types/schema";
import { TagDto } from "./dto/tag.dto";

type TagsRow = Database["public"]["Tables"]["tags"]["Row"];
type FeedItemTagsRow = Database["public"]["Tables"]["feed_item_tags"]["Row"];
type SubscriptionTagsRow =
    Database["public"]["Tables"]["user_subscription_tags"]["Row"];

export const TagMapper = {
    rowToDto(row: TagsRow): TagDto {
        return {
            id: row.id,
            tagName: row.tag_name,
            parentTagId: row.parent_tag_id,
            description: row.description,
            color: row.color,
        };
    },
    entityToDto(entity: TagEntity): TagDto {
        return {
            id: entity.id,
            tagName: entity.tag_name,
            parentTagId: entity.parent_tag_id,
            description: entity.description ?? undefined,
            color: entity.color ?? undefined,
        };
    },

    listToDto(rows: TagsRow[]): TagDto[] {
        return rows.map((r) => TagMapper.rowToDto(r));
    },

    fromFeedItemJoin(
        rows: Array<FeedItemTagsRow & { tag: TagsRow }>,
    ): TagDto[] {
        return rows
            .filter((r) => !!r.tag)
            .map((r) => TagMapper.rowToDto(r.tag as TagsRow));
    },

    fromSubscriptionJoin(
        rows: Array<SubscriptionTagsRow & { tag: TagsRow }>,
    ): TagDto[] {
        return rows
            .filter((r) => !!r.tag)
            .map((r) => TagMapper.rowToDto(r.tag as TagsRow));
    },
};
