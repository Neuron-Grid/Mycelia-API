import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Matches } from "class-validator";

const HHMM_PATTERN = /^([0-1]?\d|2[0-3]):[0-5]\d$/;

export class UpdateSummarySettingDto {
    /** 要約機能の有効/無効 */
    @IsBoolean()
    enabled!: boolean;

    /** JST時刻 (HH:mm) */
    @IsOptional()
    @IsString()
    @Matches(HHMM_PATTERN)
    @Transform(
        ({ value, obj }) =>
            value ??
            obj?.summary_schedule_time ??
            obj?.summaryScheduleTime ??
            null,
    )
    summaryScheduleTime?: string | null;
}
