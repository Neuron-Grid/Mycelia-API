import { IsString } from "class-validator";

export class GeneratePodcastForTodayJobDto {
    @IsString()
    userId!: string;
}
