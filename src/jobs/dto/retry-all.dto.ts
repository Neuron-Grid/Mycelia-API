import { IsInt, IsOptional, Max, Min } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class RetryAllDto {
    /** 最大リトライ件数 */
    @AcceptSnakeCase()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(200)
    max?: number;
}
