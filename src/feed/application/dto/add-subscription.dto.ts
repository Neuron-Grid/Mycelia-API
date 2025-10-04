import { Transform } from "class-transformer";
import { IsUrl } from "class-validator";

export class AddSubscriptionDto {
    /** URL of the RSS feed to subscribe to */
    @IsUrl()
    @Transform(({ obj, value }) => value ?? obj.feed_url)
    feedUrl: string;
}
