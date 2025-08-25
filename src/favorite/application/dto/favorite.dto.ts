import { ApiProperty } from "@nestjs/swagger";

export class FavoriteDto {
    @ApiProperty({ description: "Favorite ID", example: 123 })
    id!: number;

    @ApiProperty({ description: "ユーザーID(UUID)" })
    user_id!: string;

    @ApiProperty({ description: "フィードアイテムID", example: 456 })
    feed_item_id!: number;

    @ApiProperty({
        description: "作成日時(ISO)",
        example: "2025-08-26T00:00:00.000Z",
    })
    created_at!: string;

    @ApiProperty({
        description: "更新日時(ISO)",
        example: "2025-08-26T00:00:00.000Z",
    })
    updated_at!: string;

    @ApiProperty({ description: "ソフトデリートフラグ", example: false })
    soft_deleted!: boolean;
}
