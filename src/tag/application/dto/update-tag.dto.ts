import { IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateTagDto {
    /** New name for the tag */
    @IsOptional()
    @IsString()
    newName?: string;

    /** New parent tag ID, or null to remove parent */
    @IsOptional()
    @IsNumber()
    newParentTagId?: number | null;
}
