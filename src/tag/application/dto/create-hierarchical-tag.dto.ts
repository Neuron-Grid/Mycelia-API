import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
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
    tag_name!: string;

    @ApiPropertyOptional({
        description: "Parent tag ID (null for root)",
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    parent_tag_id?: number;

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
