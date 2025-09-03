/**
 * 検索レスポンス DTO
 */

export class SearchResultDto {
    /** Content ID */
    id: number;

    /** Content title */
    title: string;

    /** Content text */
    content: string;

    /** Similarity score (0.0-1.0) */
    similarity: number;

    /** Content type */
    type: "feed_item" | "summary" | "podcast";

    /** Additional metadata */
    metadata?: Record<string, string | number | boolean | null>;
}

export class SearchResponseDto {
    /** Response message */
    message: string;

    /** Search results */
    data: SearchResultDto[];
}
