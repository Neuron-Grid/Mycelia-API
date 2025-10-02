import { IsInt, IsOptional, Max, Min } from "class-validator";

export class RetryAllDto {
    /** 最大リトライ件数 */
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(200)
    max?: number;
}
