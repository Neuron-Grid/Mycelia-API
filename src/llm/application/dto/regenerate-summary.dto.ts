import { IsOptional, IsString, Matches } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class RegenerateSummaryDto {
    /** 対象日 (JST, YYYY-MM-DD) */
    @AcceptSnakeCase()
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date?: string;

    /** プロンプトの上書き */
    @AcceptSnakeCase()
    @IsOptional()
    @IsString()
    prompt?: string;
}
