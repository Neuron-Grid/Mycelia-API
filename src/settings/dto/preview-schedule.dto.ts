import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class PreviewScheduleDto {
    @ApiProperty({
        description: "JST時刻 (HH:mm)",
        example: "06:30",
        pattern: "^([0-1]?\\d|2[0-3]):[0-5]\\d$",
    })
    @IsString()
    @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/)
    timeJst!: string;
}
