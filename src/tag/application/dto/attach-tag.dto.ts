import { IsInt, Min } from "class-validator";

export class AttachTagDto {
    /** ID of the tag */
    @IsInt()
    @Min(1)
    tagId!: number;
}
