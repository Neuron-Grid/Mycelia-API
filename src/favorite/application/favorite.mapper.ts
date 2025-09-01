import { Database } from "@/types/schema";
import { FavoriteDto } from "./dto/favorite.dto";

type Row = Database["public"]["Tables"]["feed_item_favorites"]["Row"];

export const FavoriteMapper = {
    rowToDto(row: Row): FavoriteDto {
        return {
            id: row.id,
            userId: row.user_id,
            feedItemId: row.feed_item_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            softDeleted: row.soft_deleted,
        };
    },
    listToDto(rows: Row[]): FavoriteDto[] {
        return rows.map((r) => this.rowToDto(r));
    },
};
