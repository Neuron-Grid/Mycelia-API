import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class AddSubscriptionDto {
    @ApiProperty({
        example: 'https://example.com/rss.xml',
        description: 'URL of the RSS feed to subscribe to',
    })
    @IsUrl()
    feedUrl: string;
}
