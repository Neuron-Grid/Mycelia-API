import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Min } from "class-validator";

export class RetryAllDto {
    @ApiPropertyOptional({
        description: "最大リトライ件数",
        example: 100,
        minimum: 1,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    max?: number;
}
