import { IsBoolean } from "class-validator";

export class UpdateSummarySettingDto {
    /** 要約機能の有効/無効 */
    @IsBoolean()
    enabled!: boolean;
}
