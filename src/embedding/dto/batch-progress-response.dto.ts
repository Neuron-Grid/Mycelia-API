import { ApiProperty } from "@nestjs/swagger";
import { BatchProgress, TableType } from "../types/embedding-batch.types";

export class BatchProgressItemDto implements BatchProgress {
    @ApiProperty({ example: "user-uuid-123" })
    userId: string;

    @ApiProperty({
        enum: ["feed_items", "daily_summaries", "podcast_episodes", "tags"],
        example: "feed_items",
    })
    tableType: TableType;

    @ApiProperty({
        enum: ["waiting", "running", "completed", "failed"],
        example: "running",
    })
    status: "waiting" | "running" | "completed" | "failed";

    @ApiProperty({ example: 75.5, description: "Progress percentage (0-100)" })
    progress: number;

    @ApiProperty({ example: 1000, required: false })
    totalRecords?: number;

    @ApiProperty({ example: 755, required: false })
    processedRecords?: number;

    @ApiProperty({ required: false })
    estimatedCompletion?: Date;
}

export class BatchProgressResponseDto {
    @ApiProperty({ example: "Progress retrieved successfully" })
    message: string;

    @ApiProperty({
        type: [BatchProgressItemDto],
        description: "Array of batch progress information",
    })
    data: BatchProgressItemDto[];
}
