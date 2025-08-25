import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";

export class RunSummaryNowDto {
    @ApiPropertyOptional({
        description: "対象日 (JST, YYYY-MM-DD)",
        example: "2025-08-26",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    })
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date?: string;
}
