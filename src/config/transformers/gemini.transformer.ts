import type { GeminiConfig } from "@/config/app-env";

const DEFAULT_GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

export function buildGeminiConfig(env: NodeJS.ProcessEnv): GeminiConfig {
    const apiKey = env.GEMINI_API_KEY?.trim() ?? "";
    const apiUrl = env.GEMINI_API_URL?.trim() ?? DEFAULT_GEMINI_API_URL;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY must be configured");
    }

    return {
        apiKey,
        apiUrl: apiUrl.length > 0 ? apiUrl : DEFAULT_GEMINI_API_URL,
    };
}
