import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsBoolean,
    IsIn,
    IsOptional,
    IsString,
    Matches,
} from "class-validator";

export class UpdatePodcastSettingDto {
    @ApiProperty({
        description: "ポッドキャスト機能の有効/無効",
        example: true,
    })
    @IsBoolean()
    enabled!: boolean;

    @ApiPropertyOptional({
        description: "JST時刻 (HH:mm)",
        example: "08:00",
        pattern: "^([0-1]?\\d|2[0-3]):[0-5]\\d$",
    })
    @IsOptional()
    @IsString()
    @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/)
    time?: string;

    @ApiPropertyOptional({
        description: "音声言語",
        enum: ["ja-JP", "en-US"],
        example: "ja-JP",
    })
    @IsOptional()
    @IsIn(["ja-JP", "en-US"])
    language?: "ja-JP" | "en-US";
}
