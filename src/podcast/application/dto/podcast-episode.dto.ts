import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";

// Podcast episode update DTO
// @description DTO for updating a podcast episode from the client
export class UpdatePodcastEpisodeDto {
    /** Podcast episode title */
    @IsString()
    @IsOptional()
    title?: string;
}

// Podcast episode creation DTO
// @description DTO for creating a new podcast episode
export class CreatePodcastEpisodeDto {
    /** Related summary ID */
    @IsNumber()
    @Min(1)
    @Transform(({ obj, value }) => value ?? obj.summary_id)
    summaryId: number;

    /** Podcast episode title */
    @IsString()
    @IsOptional()
    title?: string;
}

// Podcast episode response DTO
// @description Podcast episode information returned from the server
export class PodcastEpisodeResponseDto {
    /** Podcast episode ID */
    id: number;

    /** Owner user ID */
    userId: string;

    /** Related summary ID */
    summaryId: number;

    /** Podcast episode title */
    title: string | null;

    /** Audio file URL */
    audioUrl: string | null;

    /** Whether the episode is soft-deleted */
    softDeleted: boolean;

    /** Created at (ISO) */
    createdAt: string;

    /** Updated at (ISO) */
    updatedAt: string;
}

// Podcast episodes list response DTO
// @description Paginated list of episodes
export class PodcastEpisodeListResponseDto {
    /** Podcast episode list */
    episodes: PodcastEpisodeResponseDto[];

    /** Total number of episodes */
    total: number;

    /** Current page number (1-based) */
    page: number;

    /** Items per page */
    limit: number;

    /** Total pages */
    totalPages: number;
}

// Podcast episode generation request DTO
// @description DTO for a podcast episode generation job
export class GeneratePodcastEpisodeDto {
    /** ID of the summary to generate audio from */
    @IsNumber()
    @Min(1)
    @Transform(({ obj, value }) => value ?? obj.summary_id)
    summaryId: number;

    /** Custom prompt (optional) */
    @IsString()
    @IsOptional()
    prompt?: string;
}

// Podcast episode generation job response DTO
// @description Result of the generation job
export class PodcastGenerationJobResponseDto {
    /** Job start message */
    message: string;

    /** Generation job ID */
    jobId?: string;

    /** Created episode ID (if already exists) */
    episodeId?: number;
}
