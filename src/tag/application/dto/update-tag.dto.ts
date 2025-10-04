import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateTagDto {
    /** New name for the tag */
    @IsOptional()
    @IsString()
    @Transform(({ obj, value }) => value ?? obj.new_name)
    newName?: string;

    /** New parent tag ID, or null to remove parent */
    @IsOptional()
    @IsNumber()
    @Transform(
        ({ obj, value }) =>
            value ??
            (Object.hasOwn(obj, "new_parent_tag_id")
                ? obj.new_parent_tag_id
                : undefined),
    )
    newParentTagId?: number | null;
}
