import { IsString, Matches } from "class-validator";

export class PreviewScheduleDto {
    /** JST時刻 (HH:mm) */
    @IsString()
    @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/)
    timeJst!: string;
}
