/**
 * お気に入り DTO
 */

export class FavoriteDto {
    /** Favorite ID */
    id!: number;

    /** User ID (UUID) */
    userId!: string;

    /** Feed item ID */
    feedItemId!: number;

    /** Created at (ISO) */
    createdAt!: string;

    /** Updated at (ISO) */
    updatedAt!: string;

    /** Soft delete flag */
    softDeleted!: boolean;
}
