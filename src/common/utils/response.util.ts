export class SuccessResponse<T> {
    /** Human readable message */
    message!: string;
    /** Payload (nullable) */
    data!: T | null;
}

export function buildResponse<T>(
    message: string,
    data: T | null = null,
): SuccessResponse<T> {
    return { message, data } as SuccessResponse<T>;
}
