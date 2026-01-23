export const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message?: unknown }).message;
        return typeof message === "string" ? message : "Unknown error";
    }
    return "Unknown error";
};
