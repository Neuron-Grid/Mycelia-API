import { IsUrl } from 'class-validator'

export class AddSubscriptionDto {
    @IsUrl()
    feedUrl: string
}
