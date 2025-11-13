import type { FeedFetchConfig } from "@/config/app-env";

function parseBoolean(
    value: string | undefined,
    defaultValue: boolean,
): boolean {
    if (value === undefined) return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return defaultValue;
}

function parseNumber(value: string | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function buildFeedFetchConfig(env: NodeJS.ProcessEnv): FeedFetchConfig {
    return {
        allowHttp: parseBoolean(env.FEED_FETCH_ALLOW_HTTP, false),
        userAgent: env.FEED_FETCH_USER_AGENT?.trim() ?? "MyceliaRSSFetcher/1.0",
        connectTimeoutMs: parseNumber(env.FEED_FETCH_CONNECT_TIMEOUT_MS, 2000),
        responseTimeoutMs: parseNumber(
            env.FEED_FETCH_RESPONSE_TIMEOUT_MS,
            5000,
        ),
        bodyIdleTimeoutMs: parseNumber(
            env.FEED_FETCH_BODY_IDLE_TIMEOUT_MS,
            5000,
        ),
        totalTimeoutMs: parseNumber(env.FEED_FETCH_TOTAL_TIMEOUT_MS, 10000),
        maxRedirects: parseNumber(env.FEED_FETCH_MAX_REDIRECTS, 3),
        maxBytes: parseNumber(env.FEED_FETCH_MAX_BYTES, 5_242_880),
        extraDenyCidrsRaw: env.FEED_FETCH_EXTRA_DENY_CIDRS?.trim() ?? "",
    };
}
