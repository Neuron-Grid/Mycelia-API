import { ApiProperty } from "@nestjs/swagger";
import {
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    Matches,
} from "class-validator";

//  Podcast settings update DTO
//  @description DTO for updating podcast settings from the client
export class UpdatePodcastConfigDto {
    @ApiProperty({
        description: "Enable/disable the podcast feature",
        example: true,
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    podcast_enabled?: boolean;

    @ApiProperty({
        description: "Podcast generation schedule time (HH:MM)",
        example: "07:30",
        required: false,
    })
    @IsString()
    @IsOptional()
    @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Schedule time must be in HH:MM format (e.g., 07:30)",
    })
    podcast_schedule_time?: string;

    @ApiProperty({
        description: "Podcast language",
        example: "ja-JP",
        enum: ["ja-JP", "en-US"],
        required: false,
    })
    @IsEnum(["ja-JP", "en-US"], {
        message: "Language must be 'ja-JP' or 'en-US'",
    })
    @IsOptional()
    podcast_language?: "ja-JP" | "en-US";
}

//  Podcast settings response DTO
//  @description Podcast settings returned from the server
export class PodcastConfigResponseDto {
    @ApiProperty({
        description: "Whether the podcast feature is enabled",
        example: true,
    })
    podcast_enabled: boolean;

    @ApiProperty({
        description: "Podcast generation schedule time (HH:MM)",
        example: "07:30",
        nullable: true,
    })
    podcast_schedule_time: string | null;

    @ApiProperty({
        description: "Podcast language",
        example: "ja-JP",
        enum: ["ja-JP", "en-US"],
    })
    podcast_language: "ja-JP" | "en-US";

    @ApiProperty({
        description: "Last updated timestamp",
        example: "2025-05-13T07:30:00.000Z",
    })
    updated_at: string;
}
