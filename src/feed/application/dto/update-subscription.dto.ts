import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateSubscriptionDto {
    /** Custom title for the feed (max 100 chars). Also accepts `feed_title`. */
    @IsOptional()
    @IsString()
    @MaxLength(100)
    @Transform(({ obj, value }) => value ?? obj.feed_title)
    feedTitle?: string;
}
