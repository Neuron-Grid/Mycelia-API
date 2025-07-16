export class FavoriteEntity {
    id!: number;
    user_id!: string;
    feed_item_id!: number;
    soft_deleted!: boolean;
    created_at!: string;
    updated_at!: string;

    constructor(data: Partial<FavoriteEntity> = {}) {
        Object.assign(this, data);
    }

    isActive(): boolean {
        return !this.soft_deleted;
    }

    isCreatedWithinDays(days: number): boolean {
        const createdAt = new Date(this.created_at);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return createdAt >= cutoffDate;
    }

    getDaysElapsed(): number {
        const createdAt = new Date(this.created_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    isRecentlyAdded(): boolean {
        return this.isCreatedWithinDays(7);
    }
}
