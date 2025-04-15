import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { Database } from 'src/types/schema'

export class UpdateSubscriptionDto {
    @ApiPropertyOptional({
        example: '1hour',
        description: 'How often to refresh the feed',
        enum: ['5minute', '10minute', '30minute', '1hour', '2hour', '4hour', '6hour', '12hour'],
    })
    @IsOptional()
    @IsIn(['5minute', '10minute', '30minute', '1hour', '2hour', '4hour', '6hour', '12hour'])
    refresh_interval?: Database['public']['Enums']['refresh_interval_enum']

    @ApiPropertyOptional({
        example: 'My Custom Feed Title',
        description: 'Custom title for the feed (max 100 chars)',
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    feed_title?: string
}
