import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchRequestDto {
    @ApiProperty({
        description: 'Search query',
        example: 'artificial intelligence',
    })
    @IsString()
    query: string;

    @ApiProperty({
        description: 'Maximum number of results (1-100)',
        minimum: 1,
        maximum: 100,
        default: 20,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number;

    @ApiProperty({
        description: 'Similarity threshold (0.0-1.0)',
        minimum: 0,
        maximum: 1,
        default: 0.7,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    threshold?: number;

    @ApiProperty({
        description: 'Content types to search',
        enum: ['feed_item', 'summary', 'podcast'],
        isArray: true,
        required: false,
        example: ['feed_item', 'summary'],
    })
    @IsOptional()
    @IsArray()
    includeTypes?: ('feed_item' | 'summary' | 'podcast')[];
}
