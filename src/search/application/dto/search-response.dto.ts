import { ApiProperty } from "@nestjs/swagger";

export class SearchResultDto {
    @ApiProperty({
        description: "Content ID",
        example: 123,
    })
    id: number;

    @ApiProperty({
        description: "Content title",
        example: "AI Breakthrough in Medical Research",
    })
    title: string;

    @ApiProperty({
        description: "Content text",
        example: "A new AI system has been developed...",
    })
    content: string;

    @ApiProperty({
        description: "Similarity score (0.0-1.0)",
        minimum: 0,
        maximum: 1,
        example: 0.85,
    })
    similarity: number;

    @ApiProperty({
        description: "Content type",
        enum: ["feed_item", "summary", "podcast"],
        example: "feed_item",
    })
    type: "feed_item" | "summary" | "podcast";

    @ApiProperty({
        description: "Additional metadata",
        required: false,
        example: { link: "https://example.com", published_at: "2024-01-01" },
    })
    metadata?: Record<string, string | number | boolean | null>;
}

export class SearchResponseDto {
    @ApiProperty({
        description: "Response message",
        example: "Search completed successfully",
    })
    message: string;

    @ApiProperty({
        description: "Search results",
        type: [SearchResultDto],
    })
    data: SearchResultDto[];
}
