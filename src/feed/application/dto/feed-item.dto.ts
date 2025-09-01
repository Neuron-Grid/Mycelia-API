import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FeedItemDto {
    @ApiProperty({ example: 1001 })
    id!: number;

    @ApiProperty({ description: "Subscription ID" })
    userSubscriptionId!: number;

    @ApiProperty()
    userId!: string;

    @ApiProperty()
    title!: string;

    @ApiProperty()
    link!: string;

    @ApiPropertyOptional({ nullable: true })
    linkHash?: string | null;

    @ApiPropertyOptional({ nullable: true })
    description?: string | null;

    @ApiPropertyOptional({ description: "Published at (ISO)", nullable: true })
    publishedAt?: string | null;

    @ApiPropertyOptional({ nullable: true })
    titleEmb?: string | null;

    @ApiProperty()
    softDeleted!: boolean;

    @ApiProperty()
    createdAt!: string;

    @ApiProperty()
    updatedAt!: string;

    @ApiProperty({ description: "Favorited by current user" })
    isFavorite!: boolean;

    @ApiProperty({ description: "Applied tag names", type: [String] })
    tags!: string[];
}
