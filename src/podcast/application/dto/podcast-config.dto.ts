import { Transform } from "class-transformer";
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
    /** Enable/disable the podcast feature */
    @IsBoolean()
    @IsOptional()
    @Transform(({ obj, value }) => value ?? obj.podcast_enabled)
    podcastEnabled?: boolean;

    /** Podcast generation schedule time (HH:MM) */
    @IsString()
    @IsOptional()
    @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Schedule time must be in HH:MM format (e.g., 07:30)",
    })
    @Transform(({ obj, value }) => value ?? obj.podcast_schedule_time)
    podcastScheduleTime?: string;

    /** Podcast language */
    @IsEnum(["ja-JP", "en-US"], {
        message: "Language must be 'ja-JP' or 'en-US'",
    })
    @IsOptional()
    @Transform(({ obj, value }) => value ?? obj.podcast_language)
    podcastLanguage?: "ja-JP" | "en-US";
}

//  Podcast settings response DTO
//  @description Podcast settings returned from the server
export class PodcastConfigResponseDto {
    /** Whether the podcast feature is enabled */
    podcastEnabled: boolean;

    /** Podcast generation schedule time (HH:MM) */
    podcastScheduleTime: string | null;

    /** Podcast language */
    podcastLanguage: "ja-JP" | "en-US";

    /** Last updated timestamp (ISO) */
    updatedAt: string;
}
