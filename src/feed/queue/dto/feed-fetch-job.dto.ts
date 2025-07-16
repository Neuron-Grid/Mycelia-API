import { IsInt, IsPositive, IsString, IsUrl } from 'class-validator';

export class FeedFetchJobDto {
    @IsInt()
    @IsPositive()
    subscriptionId!: number;

    @IsString()
    userId!: string;

    @IsUrl()
    feedUrl!: string;

    @IsString()
    feedTitle!: string;
}
