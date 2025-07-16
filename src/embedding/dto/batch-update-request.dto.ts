import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { TableType } from '../types/embedding-batch.types';

export class BatchUpdateRequestDto {
    @ApiProperty({
        description: 'Table types to update embeddings for',
        enum: ['feed_items', 'daily_summaries', 'podcast_episodes', 'tags'],
        isArray: true,
        required: false,
        example: ['feed_items', 'daily_summaries'],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(['feed_items', 'daily_summaries', 'podcast_episodes', 'tags'], { each: true })
    tableTypes?: TableType[];
}
