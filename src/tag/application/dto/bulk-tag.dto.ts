import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsInt, Min } from "class-validator";

export class BulkTagDto {
    @ApiProperty({
        description: "IDs of tags to apply",
        example: [1, 2, 3],
        type: [Number],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    @Min(1, { each: true })
    tagIds!: number[];
}
