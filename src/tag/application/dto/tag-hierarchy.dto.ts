import { Transform } from "class-transformer";

export class TagHierarchyDto {
    id!: number;

    tagName!: string;

    parentTagId!: number | null;

    description?: string;

    color?: string;

    /** Child tags */
    children!: TagHierarchyDto[];

    /** Path from root */
    path!: string[];

    /** Hierarchy level (0 = root) */
    level!: number;

    /** Number of feeds associated with this tag */
    feedCount?: number;
}

export class TagWithPathDto {
    id!: number;

    tagName!: string;

    parentTagId!: number | null;

    /** Full path (separated by >) */
    fullPath!: string;

    /** Path array */
    pathArray!: string[];

    /** Hierarchy level (0 = root) */
    level!: number;
}

export class MoveTagDto {
    /** New parent tag ID (null to move to root) */
    @Transform(({ obj, value }) => value ?? obj.new_parent_id)
    newParentId?: number | null;
}
