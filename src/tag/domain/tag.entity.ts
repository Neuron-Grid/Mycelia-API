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

    // Ӹ͹�ï: ��ȿ�KiFK���ï
    isRootTag(): boolean {
        return this.parent_tag_id === null
    }

    // Ӹ͹�ï: P��KiFK���ï
    isChildTag(): boolean {
        return this.parent_tag_id !== null
    }

    // Ӹ͹�ï: ��n<
    isValidTagName(): boolean {
        return !!(this.tag_name && this.tag_name.length > 0 && this.tag_name.length <= 100)
    }

    // Ӹ͹�ï: ���gn<parent_tag_idL��gjDSh���	
    isValidParentRelation(): boolean {
        return this.parent_tag_id !== this.id
    }

    // Ӹ͹�ï: ��nh:�֗�dh:(	
    getDisplayName(parentTagName?: string): string {
        if (this.isRootTag() || !parentTagName) {
            return this.tag_name
        }
        return `${parentTagName} > ${this.tag_name}`
    }

    // Ӹ͹�ï: ���c�M�nz}�Jd�W	
    normalizeTagName(): string {
        return this.tag_name.trim().toLowerCase()
    }
}