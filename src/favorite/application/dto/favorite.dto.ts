import { ApiProperty } from "@nestjs/swagger";

export class FavoriteDto {
    @ApiProperty({ description: "Favorite ID", example: 123 })
    id!: number;

    @ApiProperty({ description: "User ID (UUID)" })
    userId!: string;

    @ApiProperty({ description: "Feed item ID", example: 456 })
    feedItemId!: number;

    @ApiProperty({
        description: "Created at (ISO)",
        example: "2025-08-26T00:00:00.000Z",
    })
    createdAt!: string;

    @ApiProperty({
        description: "Updated at (ISO)",
        example: "2025-08-26T00:00:00.000Z",
    })
    updatedAt!: string;

    @ApiProperty({ description: "Soft delete flag", example: false })
    softDeleted!: boolean;
}
