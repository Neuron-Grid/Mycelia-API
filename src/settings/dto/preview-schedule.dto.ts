import { IsString, Matches } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class PreviewScheduleDto {
    /** JST時刻 (HH:mm) */
    @AcceptSnakeCase()
    @IsString()
    @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/)
    timeJst!: string;
}
