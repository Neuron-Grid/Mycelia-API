import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";

// Podcast episode update DTO
// @description DTO for updating a podcast episode from the client
export class UpdatePodcastEpisodeDto {
    @ApiProperty({
        description: "Podcast episode title",
        example: "Today's news summary - 2025-05-13",
        required: false,
    })
    @IsString()
    @IsOptional()
    title?: string;
}

// Podcast episode creation DTO
// @description DTO for creating a new podcast episode
export class CreatePodcastEpisodeDto {
    @ApiProperty({
        description: "Related summary ID",
        example: 123,
    })
    @IsNumber()
    @Min(1)
    summary_id: number;

    @ApiProperty({
        description: "Podcast episode title",
        example: "Today's news summary - 2025-05-13",
        required: false,
    })
    @IsString()
    @IsOptional()
    title?: string;
}

// Podcast episode response DTO
// @description Podcast episode information returned from the server
export class PodcastEpisodeResponseDto {
    @ApiProperty({
        description: "Podcast episode ID",
        example: 1,
    })
    id: number;

    @ApiProperty({
        description: "Owner user ID",
        example: "user-uuid-123",
    })
    user_id: string;

    @ApiProperty({
        description: "Related summary ID",
        example: 123,
    })
    summary_id: number;

    @ApiProperty({
        description: "Podcast episode title",
        example: "Today's news summary - 2025-05-13",
        nullable: true,
        type: String,
    })
    title: string | null;

    @ApiProperty({
        description: "Audio file URL",
        example: "https://storage.example.com/episodes/episode-123.mp3",
        nullable: true,
        type: String,
    })
    audio_url: string | null;

    @ApiProperty({
        description: "Whether the episode is soft-deleted",
        example: false,
    })
    soft_deleted: boolean;

    @ApiProperty({
        description: "Created at",
        example: "2025-05-13T07:30:00.000Z",
    })
    created_at: string;

    @ApiProperty({
        description: "Updated at",
        example: "2025-05-13T07:30:00.000Z",
    })
    updated_at: string;
}

// Podcast episodes list response DTO
// @description Paginated list of episodes
export class PodcastEpisodeListResponseDto {
    @ApiProperty({
        description: "Podcast episode list",
        type: [PodcastEpisodeResponseDto],
    })
    episodes: PodcastEpisodeResponseDto[];

    @ApiProperty({
        description: "Total number of episodes",
        example: 50,
    })
    total: number;

    @ApiProperty({
        description: "Current page number (1-based)",
        example: 1,
    })
    page: number;

    @ApiProperty({
        description: "Items per page",
        example: 20,
    })
    limit: number;

    @ApiProperty({
        description: "Total pages",
        example: 3,
    })
    total_pages: number;
}

// Podcast episode generation request DTO
// @description DTO for a podcast episode generation job
export class GeneratePodcastEpisodeDto {
    @ApiProperty({
        description: "ID of the summary to generate audio from",
        example: 123,
    })
    @IsNumber()
    @Min(1)
    summary_id: number;

    @ApiProperty({
        description: "Custom prompt (optional)",
        example: "Please provide more detailed explanations.",
        required: false,
    })
    @IsString()
    @IsOptional()
    prompt?: string;
}

// Podcast episode generation job response DTO
// @description Result of the generation job
export class PodcastGenerationJobResponseDto {
    @ApiProperty({
        description: "Job start message",
        example:
            "Podcast generation job (ID: job-123) has been queued for summary ID 123.",
    })
    message: string;

    @ApiProperty({
        description: "Generation job ID",
        example: "job-123",
        required: false,
    })
    job_id?: string;

    @ApiProperty({
        description: "Created episode ID (if already exists)",
        example: 456,
        required: false,
    })
    episode_id?: number;
}
