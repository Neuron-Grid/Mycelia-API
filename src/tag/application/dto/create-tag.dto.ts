import { Transform } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class CreateTagDto {
    /** Name of the tag */
    @IsNotEmpty()
    @Transform(({ obj, value }) => value ?? obj.tag_name)
    tagName: string;

    /** ID of the parent tag (if this is a subtag) */
    @IsOptional()
    @IsNumber()
    @Transform(({ obj, value }) => value ?? obj.parent_tag_id)
    parentTagId?: number;
}
