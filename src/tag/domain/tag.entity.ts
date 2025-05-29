export class TagEntity {
    id!: number
    user_id!: string
    tag_name!: string
    parent_tag_id!: number | null
    soft_deleted!: boolean
    created_at!: string
    updated_at!: string

    constructor(data: Partial<TagEntity> = {}) {
        Object.assign(this, data)
    }

    // ”∏ÕπÌ∏√Ø: Î¸»ø∞KiFKí¡ß√Ø
    isRootTag(): boolean {
        return this.parent_tag_id === null
    }

    // ”∏ÕπÌ∏√Ø: Pø∞KiFKí¡ß√Ø
    isChildTag(): boolean {
        return this.parent_tag_id !== null
    }

    // ”∏ÕπÌ∏√Ø: ø∞n<
    isValidTagName(): boolean {
        return !!(this.tag_name && this.tag_name.length > 0 && this.tag_name.length <= 100)
    }

    // ”∏ÕπÌ∏√Ø: ™∞¬gn<parent_tag_idLÍÍ´gjDShí∫ç	
    isValidParentRelation(): boolean {
        return this.parent_tag_id !== this.id
    }

    // ”∏ÕπÌ∏√Ø: ø∞nh:í÷óédh:(	
    getDisplayName(parentTagName?: string): string {
        if (this.isRootTag() || !parentTagName) {
            return this.tag_name
        }
        return `${parentTagName} > ${this.tag_name}`
    }

    // ”∏ÕπÌ∏√Ø: ø∞ícèMånz}íJdáW	
    normalizeTagName(): string {
        return this.tag_name.trim().toLowerCase()
    }
}