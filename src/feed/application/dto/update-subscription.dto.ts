import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateSubscriptionDto {
    @ApiPropertyOptional({
        example: "My custom feed title",
        description:
            "Custom title for the feed (max 100 chars). Migration note: also accepts `feed_title`.",
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    @Transform(({ obj, value }) => value ?? obj.feed_title)
    feedTitle?: string;
}
