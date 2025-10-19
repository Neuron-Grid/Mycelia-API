import { IsBoolean, IsOptional, IsString, Matches } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

const HHMM_PATTERN = /^([0-1]?\d|2[0-3]):[0-5]\d$/;

export class UpdateSummarySettingDto {
    /** 要約機能の有効/無効 */
    @AcceptSnakeCase()
    @IsBoolean()
    enabled!: boolean;

    /** JST時刻 (HH:mm) */
    @AcceptSnakeCase()
    @IsOptional()
    @IsString()
    @Matches(HHMM_PATTERN)
    summaryScheduleTime?: string;
}
