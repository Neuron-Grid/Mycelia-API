export class TagEntity {
    id!: number
    user_id!: string
    tag_name!: string
    parent_tag_id!: number | null
    soft_deleted!: boolean
    created_at!: string
    updated_at!: string
    tag_embedding?: string | null
    description?: string | null
    color?: string | null

    constructor(data: Partial<TagEntity> = {}) {
        Object.assign(this, data)
    }

    isRootTag(): boolean {
        return this.parent_tag_id === null
    }

    isChildTag(): boolean {
        return this.parent_tag_id !== null
    }

    isValidTagName(): boolean {
        return !!(this.tag_name && this.tag_name.length > 0 && this.tag_name.length <= 100)
    }

    isValidParentRelation(): boolean {
        return this.parent_tag_id !== this.id
    }

    getDisplayName(parentTagName?: string): string {
        if (this.isRootTag() || !parentTagName) {
            return this.tag_name
        }
        return `${parentTagName} > ${this.tag_name}`
    }

    normalizeTagName(): string {
        return this.tag_name.trim().toLowerCase()
    }
}
