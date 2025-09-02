export interface SuccessResponse<T> {
    message: string;
    data: T | null;
}

export function buildResponse<T>(
    message: string,
    data: T | null = null,
): SuccessResponse<T> {
    return { message, data };
}
