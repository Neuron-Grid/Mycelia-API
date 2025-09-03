/**
 * フィードアイテム DTO
 */

export class FeedItemDto {
    id!: number;

    userSubscriptionId!: number;

    userId!: string;

    title!: string;

    link!: string;

    linkHash?: string | null;

    description?: string | null;

    publishedAt?: string | null;

    titleEmb?: string | null;

    softDeleted!: boolean;

    createdAt!: string;

    updatedAt!: string;

    isFavorite!: boolean;

    tags!: string[];
}
