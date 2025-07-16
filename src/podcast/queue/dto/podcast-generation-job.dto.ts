import { IsInt, IsPositive, IsString } from "class-validator";

export class PodcastGenerationJobDto {
    @IsString()
    userId!: string;

    @IsInt()
    @IsPositive()
    summaryId!: number;
}

export class AudioEnhancementJobDto {
    @IsInt()
    @IsPositive()
    episodeId!: number;

    @IsString()
    userId!: string;
}

export class PodcastCleanupJobDto {
    @IsString()
    userId!: string;

    @IsInt()
    @IsPositive()
    daysOld!: number;
}
