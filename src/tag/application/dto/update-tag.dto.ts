import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateTagDto {
    @ApiPropertyOptional({
        example: "Updated Tag Name",
        description: "New name for the tag",
    })
    @IsOptional()
    @IsString()
    newName?: string;

    @ApiPropertyOptional({
        example: 2,
        description: "New parent tag ID, or null to remove parent",
        type: Number,
        nullable: true,
    })
    @IsOptional()
    @IsNumber()
    newParentTagId?: number | null;
}
