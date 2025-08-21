import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class AttachTagDto {
    @ApiProperty({ description: "ID of the tag", example: 1 })
    @IsInt()
    @Min(1)
    tagId!: number;
}
