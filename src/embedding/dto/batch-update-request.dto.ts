import { IsArray, IsEnum, IsOptional } from "class-validator";
import type { TableType } from "../types/embedding-batch.types";

export class BatchUpdateRequestDto {
    /** Table types to update embeddings for */
    @IsOptional()
    @IsArray()
    @IsEnum(["feed_items", "daily_summaries", "podcast_episodes", "tags"], {
        each: true,
    })
    tableTypes?: TableType[];
}
