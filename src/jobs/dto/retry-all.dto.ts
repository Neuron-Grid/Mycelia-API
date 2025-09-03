import { IsInt, IsOptional, Min } from "class-validator";

export class RetryAllDto {
    /** 最大リトライ件数 */
    @IsOptional()
    @IsInt()
    @Min(1)
    max?: number;
}
