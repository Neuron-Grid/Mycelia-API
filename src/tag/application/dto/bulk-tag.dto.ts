import { Transform } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsInt, Min } from "class-validator";

export class BulkTagDto {
    /** IDs of tags to apply */
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    @Min(1, { each: true })
    @Transform(({ obj, value }) => value ?? obj.tag_ids)
    tagIds!: number[];
}
