import type { CorsConfig } from "@/config/app-env";

function splitOrigins(raw: string): string[] {
    return raw
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

export function buildCorsConfig(env: NodeJS.ProcessEnv): CorsConfig {
    const originsRaw = env.CORS_ORIGIN?.trim() ?? "";
    return {
        origins: originsRaw.length > 0 ? splitOrigins(originsRaw) : [],
        credentials: true,
    };
}
