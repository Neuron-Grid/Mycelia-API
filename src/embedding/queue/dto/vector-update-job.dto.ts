import { IsIn, IsInt, IsOptional, IsPositive, IsString } from "class-validator";

export class VectorUpdateJobDto {
    @IsString()
    userId!: string;

    @IsString()
    @IsIn(["feed_items", "daily_summaries", "podcast_episodes", "tags"])
    tableType!: "feed_items" | "daily_summaries" | "podcast_episodes" | "tags";

    @IsOptional()
    @IsInt()
    @IsPositive()
    batchSize?: number;

    @IsOptional()
    @IsInt()
    @IsPositive()
    lastProcessedId?: number;

    @IsOptional()
    @IsInt()
    @IsPositive()
    totalEstimate?: number;

    @IsOptional()
    @IsInt()
    @IsPositive()
    recordId?: number;
}
