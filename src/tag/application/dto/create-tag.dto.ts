import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class CreateTagDto {
    @ApiProperty({ example: "Technology", description: "Name of the tag" })
    @IsNotEmpty()
    tagName: string;

    @ApiPropertyOptional({
        example: 1,
        description: "ID of the parent tag (if this is a subtag)",
    })
    @IsOptional()
    @IsNumber()
    parentTagId?: number;
}
