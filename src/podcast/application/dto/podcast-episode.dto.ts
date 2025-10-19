import { IsNumber, IsOptional, IsString, Min } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

// Podcast episode update DTO
// @description DTO for updating a podcast episode from the client
export class UpdatePodcastEpisodeDto {
    /** Podcast episode title */
    @AcceptSnakeCase()
    @IsString()
    @IsOptional()
    title?: string;
}

// Podcast episode creation DTO
// @description DTO for creating a new podcast episode
export class CreatePodcastEpisodeDto {
    /** Related summary ID */
    @AcceptSnakeCase()
    @IsNumber()
    @Min(1)
    summaryId: number;

    /** Podcast episode title */
    @AcceptSnakeCase()
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
    title: string;

    /** Audio file URL */
    audioUrl: string;

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
    @AcceptSnakeCase()
    @IsNumber()
    @Min(1)
    summaryId: number;

    /** Custom prompt (optional) */
    @AcceptSnakeCase()
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
