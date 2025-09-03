import {
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
} from "class-validator";

export class SearchRequestDto {
    /** Search query */
    @IsString()
    query: string;

    /** Maximum number of results (1-100) */
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number;

    /** Similarity threshold (0.0-1.0) */
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    threshold?: number;

    /** Content types to search */
    @IsOptional()
    @IsArray()
    includeTypes?: ("feed_item" | "summary" | "podcast")[];
}
