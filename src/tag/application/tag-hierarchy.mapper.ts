import { TagHierarchyDto, TagWithPathDto } from "./dto/tag-hierarchy.dto";
import type { TagHierarchy, TagWithPath } from "./hierarchical-tag.service";

export const TagHierarchyMapper = {
    toDto(node: TagHierarchy): TagHierarchyDto {
        return {
            id: node.id,
            tagName: node.tag_name,
            parentTagId: node.parent_tag_id,
            description: node.description,
            color: node.color,
            children: node.children.map((c) => this.toDto(c)),
            path: node.path,
            level: node.level,
            feedCount: node.feed_count,
        };
    },
    toDtoList(nodes: TagHierarchy[]): TagHierarchyDto[] {
        return nodes.map((n) => this.toDto(n));
    },
    pathToDto(node: TagWithPath): TagWithPathDto {
        return {
            id: node.id,
            tagName: node.tag_name,
            parentTagId: node.parent_tag_id,
            fullPath: node.full_path,
            pathArray: node.path_array,
            level: node.level,
        };
    },
};
