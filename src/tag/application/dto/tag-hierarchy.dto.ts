import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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
    tag_name!: string;

    @ApiPropertyOptional({
        description: "Parent tag ID",
        example: null,
        type: Number,
        nullable: true,
    })
    parent_tag_id!: number | null;

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
    feed_count?: number;
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
    tag_name!: string;

    @ApiPropertyOptional({
        description: "Parent tag ID",
        example: 2,
        type: Number,
        nullable: true,
    })
    parent_tag_id!: number | null;

    @ApiProperty({
        description: "Full path (separated by >)",
        example: "Technology > Programming > JavaScript",
    })
    full_path!: string;

    @ApiProperty({
        description: "Path array",
        type: [String],
        example: ["Technology", "Programming", "JavaScript"],
    })
    path_array!: string[];

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
    new_parent_id?: number | null;
}
