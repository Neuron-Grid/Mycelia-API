import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class TagHierarchyDto {
    @ApiProperty({
        description: "Tag ID",
        example: 1,
    })
    id!: number;

    @ApiProperty({
        description: "Tag name",
        example: "Technology",
    })
    tagName!: string;

    @ApiPropertyOptional({
        description: "Parent tag ID",
        example: null,
        type: Number,
        nullable: true,
    })
    parentTagId!: number | null;

    @ApiPropertyOptional({
        description: "Tag description",
        example:
            "Technology-related articles such as programming, AI, and gadgets",
    })
    description?: string;

    @ApiPropertyOptional({
        description: "Tag color (Hex format)",
        example: "#3B82F6",
    })
    color?: string;

    @ApiProperty({
        description: "Child tags",
        type: [Object],
    })
    children!: TagHierarchyDto[];

    @ApiProperty({
        description: "Path from root",
        type: [String],
        example: ["Technology", "Programming"],
    })
    path!: string[];

    @ApiProperty({
        description: "Hierarchy level (0 = root)",
        example: 1,
    })
    level!: number;

    @ApiPropertyOptional({
        description: "Number of feeds associated with this tag",
        example: 5,
    })
    feedCount?: number;
}

export class TagWithPathDto {
    @ApiProperty({
        description: "Tag ID",
        example: 1,
    })
    id!: number;

    @ApiProperty({
        description: "Tag name",
        example: "JavaScript",
    })
    tagName!: string;

    @ApiPropertyOptional({
        description: "Parent tag ID",
        example: 2,
        type: Number,
        nullable: true,
    })
    parentTagId!: number | null;

    @ApiProperty({
        description: "Full path (separated by >)",
        example: "Technology > Programming > JavaScript",
    })
    fullPath!: string;

    @ApiProperty({
        description: "Path array",
        type: [String],
        example: ["Technology", "Programming", "JavaScript"],
    })
    pathArray!: string[];

    @ApiProperty({
        description: "Hierarchy level (0 = root)",
        example: 2,
    })
    level!: number;
}

export class MoveTagDto {
    @ApiPropertyOptional({
        description: "New parent tag ID (null to move to root)",
        example: 3,
        type: Number,
        nullable: true,
    })
    @Transform(({ obj, value }) => value ?? obj.new_parent_id)
    newParentId?: number | null;
}
