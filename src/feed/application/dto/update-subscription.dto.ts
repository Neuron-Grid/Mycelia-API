import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { Database } from 'src/types/schema'

export class UpdateSubscriptionDto {
    @IsOptional()
    @IsIn([
        '5minute',
        '10minute',
        '30minute',
        '1hour',
        '2hour',
        '4hour',
        '6hour',
        '12hour',
    ])
    refresh_interval?: Database['public']['Enums']['refresh_interval_enum']

    @IsOptional()
    @IsString()
    @MaxLength(100)
    feed_title?: string
}