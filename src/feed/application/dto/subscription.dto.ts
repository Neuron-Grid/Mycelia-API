/**
 * 購読 DTO
 */

export class SubscriptionDto {
    id!: number;

    feedUrl!: string;

    feedTitle?: string | null;

    lastFetchedAt?: string | null;

    nextFetchAt?: string | null;

    createdAt!: string;

    updatedAt!: string;
}
