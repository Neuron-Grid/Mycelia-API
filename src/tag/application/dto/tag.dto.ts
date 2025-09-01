import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TagDto {
    @ApiProperty({ description: "Tag ID", example: 1 })
    id!: number;

    @ApiProperty({ description: "Tag name", example: "Technology" })
    tagName!: string;

    @ApiPropertyOptional({
        description: "Parent tag ID (null for root)",
        type: Number,
        nullable: true,
        example: null,
    })
    parentTagId!: number | null;

    @ApiPropertyOptional({
        description: "Tag description",
        example: "AI, gadgets",
    })
    description?: string | null;

    @ApiPropertyOptional({
        description: "Color code (hex)",
        example: "#3B82F6",
    })
    color?: string | null;
}
