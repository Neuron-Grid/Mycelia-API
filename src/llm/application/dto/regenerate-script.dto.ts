import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RegenerateScriptDto {
    @ApiPropertyOptional({ description: "プロンプトの上書き" })
    @IsOptional()
    @IsString()
    prompt?: string;
}
