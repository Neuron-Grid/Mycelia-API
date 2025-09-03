/**
 * エラーレスポンス（共通）DTO
 */

export class ErrorResponseDto {
    /** HTTP status code */
    statusCode!: number;

    /** Error message(s) */
    message!: string | string[];

    /** Short error label */
    error!: string;

    /** Request path */
    path!: string;

    /** Timestamp in ISO 8601 */
    timestamp!: string;
}
