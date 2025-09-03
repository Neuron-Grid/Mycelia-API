import { IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class CreateTagDto {
    /** Name of the tag */
    @IsNotEmpty()
    tagName: string;

    /** ID of the parent tag (if this is a subtag) */
    @IsOptional()
    @IsNumber()
    parentTagId?: number;
}
