import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Length, Min } from "class-validator";

export class CreateHierarchicalTagDto {
    @ApiProperty({
        description: "Tag name",
        minLength: 1,
        maxLength: 100,
        example: "Technology",
    })
    @IsString()
    @Length(1, 100)
    @Transform(({ obj, value }) => value ?? obj.tag_name)
    tagName!: string;

    @ApiPropertyOptional({
        description: "Parent tag ID (null for root)",
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Transform(({ obj, value }) => value ?? obj.parent_tag_id)
    parentTagId?: number;

    @ApiPropertyOptional({
        description: "Tag description",
        maxLength: 500,
        example:
            "Technology-related articles such as programming, AI, and gadgets",
    })
    @IsOptional()
    @IsString()
    @Length(0, 500)
    description?: string;

    @ApiPropertyOptional({
        description: "Tag color (Hex format)",
        pattern: "^#[0-9A-Fa-f]{6}$",
        example: "#3B82F6",
    })
    @IsOptional()
    @IsString()
    color?: string;
}
