import { IsOptional, IsString } from "class-validator";

export class RegenerateScriptDto {
    /** プロンプトの上書き */
    @IsOptional()
    @IsString()
    prompt?: string;
}
