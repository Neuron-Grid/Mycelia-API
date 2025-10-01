import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Length, Min } from "class-validator";
import { IsHexColorStrict } from "@/common/validators/hex-color.decorator";

export class CreateHierarchicalTagDto {
    /** Tag name */
    @IsString()
    @Length(1, 100)
    @Transform(({ obj, value }) => value ?? obj.tag_name)
    tagName!: string;

    /** Parent tag ID (null for root) */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Transform(({ obj, value }) => value ?? obj.parent_tag_id)
    parentTagId?: number;

    /** Tag description */
    @IsOptional()
    @IsString()
    @Length(0, 500)
    description?: string;

    /** Tag color (Hex format #RRGGBB) */
    @IsOptional()
    @IsString()
    @IsHexColorStrict()
    color?: string;
}
