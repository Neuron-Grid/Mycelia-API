import { IsOptional, IsString, Matches } from "class-validator";

export class RunSummaryNowDto {
    /** 対象日 (JST, YYYY-MM-DD) */
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date?: string;
}
