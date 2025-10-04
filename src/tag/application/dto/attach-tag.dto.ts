import { Transform } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class AttachTagDto {
    /** ID of the tag */
    @IsInt()
    @Min(1)
    @Transform(({ obj, value }) => value ?? obj.tag_id)
    tagId!: number;
}
