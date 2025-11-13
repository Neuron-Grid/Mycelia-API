import type { OpenAiConfig } from "@/config/app-env";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export function buildOpenAiConfig(env: NodeJS.ProcessEnv): OpenAiConfig {
    const apiKey = env.OPENAI_API_KEY?.trim() ?? "";
    const baseUrl = env.OPENAI_API_BASE_URL?.trim() ?? DEFAULT_OPENAI_BASE_URL;

    if (!apiKey) {
        throw new Error("OPENAI_API_KEY must be configured");
    }

    return {
        apiKey,
        baseUrl: baseUrl.length > 0 ? baseUrl : DEFAULT_OPENAI_BASE_URL,
    };
}
