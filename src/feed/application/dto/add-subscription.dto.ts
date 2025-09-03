import { IsUrl } from "class-validator";

export class AddSubscriptionDto {
    /** URL of the RSS feed to subscribe to */
    @IsUrl()
    feedUrl: string;
}
