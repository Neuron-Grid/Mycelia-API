import { IsOptional, IsString } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class RegenerateScriptDto {
    /** プロンプトの上書き */
    @AcceptSnakeCase()
    @IsOptional()
    @IsString()
    prompt?: string;
}
