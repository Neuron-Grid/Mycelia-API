import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SubscriptionDto {
    @ApiProperty({ description: "Subscription ID", example: 123 })
    id!: number;

    @ApiProperty({ description: "Feed URL" })
    feedUrl!: string;

    @ApiPropertyOptional({
        description: "Custom feed title",
        example: "My Tech",
    })
    feedTitle?: string | null;

    @ApiPropertyOptional({
        description: "Last fetched at (ISO)",
        nullable: true,
    })
    lastFetchedAt?: string | null;

    @ApiPropertyOptional({ description: "Next fetch at (ISO)", nullable: true })
    nextFetchAt?: string | null;

    @ApiProperty({ description: "Created at (ISO)" })
    createdAt!: string;

    @ApiProperty({ description: "Updated at (ISO)" })
    updatedAt!: string;
}
