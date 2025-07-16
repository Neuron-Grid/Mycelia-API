import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSubscriptionDto {
    @ApiPropertyOptional({
        example: 'My custom feed title',
        description: 'Custom title for the feed (max 100 chars)',
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    feed_title?: string;
}
