export interface ResponseEnvelope<T> {
    /** Human readable message */
    message: string;
    /** Payload (nullable) */
    data: T | null;
}

export type SuccessResponse<T> = ResponseEnvelope<T>;

export function buildResponse<T>(
    message: string,
    data: T | null = null,
): ResponseEnvelope<T> {
    return { message, data } as ResponseEnvelope<T>;
}
