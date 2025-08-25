import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateSummarySettingDto {
    @ApiProperty({ description: "要約機能の有効/無効", example: true })
    @IsBoolean()
    enabled!: boolean;
}
