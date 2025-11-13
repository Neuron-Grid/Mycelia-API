import type {
    AppEnv,
    CloudflareR2Config,
    CorsConfig,
    DomainConfig,
    FeedFetchConfig,
    GeminiConfig,
    GoogleTtsConfig,
    OpenAiConfig,
    RedisConnectionConfig,
    StorageConfig,
    SupabaseAuthCacheConfig,
    SupabaseConfig,
} from "@/config/app-env";
import { buildAppEnv } from "@/config/app-env";

type EnvOverrides = Record<string, string | undefined>;

const truthyValueSet = new Set(["1", "true", "yes", "on"]);

const requiredEnvDefaults: Record<string, string> = {
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    CLOUDFLARE_ACCOUNT_ID: "test-account",
    CLOUDFLARE_ACCESS_KEY_ID: "access-key",
    CLOUDFLARE_SECRET_ACCESS_KEY: "secret-key",
    CLOUDFLARE_BUCKET_NAME: "bucket",
    GEMINI_API_KEY: "gemini-key",
    OPENAI_API_KEY: "openai-key",
    REDIS_URL: "redis://localhost:6379",
};

const emptyCors: CorsConfig = { origins: [], credentials: true };
const defaultFeedFetch: FeedFetchConfig = {
    allowHttp: false,
    maxRedirects: 3,
    connectTimeoutMs: 2000,
    responseTimeoutMs: 5000,
    bodyIdleTimeoutMs: 5000,
    totalTimeoutMs: 10000,
    maxBytes: 5_242_880,
    userAgent: "MyceliaRSSFetcher/1.0",
    extraDenyCidrsRaw: "",
};

const defaultRedis: RedisConnectionConfig = {
    mode: "single",
    options: {
        host: "127.0.0.1",
        port: 6379,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    },
};

const defaultSupabase: SupabaseConfig = {
    url: "http://localhost:54321",
    anonKey: "anon-key",
    serviceRoleKey: "service-role-key",
};

const defaultCloudflare: CloudflareR2Config = {
    accountId: "test-account",
    accessKeyId: "access-key",
    secretAccessKey: "secret-key",
    bucketName: "bucket",
    publicDomain: "",
    allowedBuckets: ["bucket"],
    allowedPrefixTemplates: ["podcasts/{userId}/"],
};

const defaultStorage: StorageConfig = {
    supabaseUploadEnabled: true,
};

const defaultGemini: GeminiConfig = {
    apiKey: "gemini-key",
    apiUrl: "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
};

const defaultOpenAi: OpenAiConfig = {
    apiKey: "openai-key",
    baseUrl: "https://api.openai.com/v1",
};

const defaultGoogleTts: GoogleTtsConfig = {};

const defaultAuthCache: SupabaseAuthCacheConfig = {
    ttlMs: 60_000,
};

const defaultDomain: DomainConfig = {};

const initialProcessEnvSnapshot = cloneEnv(process.env);
let cachedAppEnv: AppEnv | null = null;

function cloneEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return Object.fromEntries(Object.entries(env)) as NodeJS.ProcessEnv;
}

function restoreProcessEnv(snapshot: NodeJS.ProcessEnv): void {
    const currentKeys = new Set(Object.keys(process.env));
    for (const key of currentKeys) {
        if (!(key in snapshot)) {
            delete process.env[key];
        }
    }
    for (const [key, value] of Object.entries(snapshot)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
}

function rebuildTestAppEnvCache(): AppEnv {
    cachedAppEnv = buildTestAppEnv();
    return cachedAppEnv;
}

function applyDefaults(snapshot: NodeJS.ProcessEnv): void {
    for (const [key, value] of Object.entries(requiredEnvDefaults)) {
        if (!snapshot[key]) {
            snapshot[key] = value;
        }
    }
    snapshot.NODE_ENV = snapshot.NODE_ENV ?? "test";
    snapshot.PORT = snapshot.PORT ?? "3000";
}

function toBoolean(raw: string | undefined, fallback: boolean): boolean {
    if (raw === undefined || raw === null) {
        return fallback;
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0) {
        return fallback;
    }
    return truthyValueSet.has(normalized);
}

export function createAppEnvStub(
    overrides: Partial<AppEnv> = {},
    rawEnvOverrides: EnvOverrides = {},
): AppEnv {
    const stubRawEnv = cloneEnv(initialProcessEnvSnapshot);
    applyDefaults(stubRawEnv);
    for (const [key, value] of Object.entries(rawEnvOverrides)) {
        if (value === undefined) {
            delete stubRawEnv[key];
        } else {
            stubRawEnv[key] = value;
        }
    }

    const stubBase: AppEnv = {
        nodeEnv: "test",
        port: Number(stubRawEnv.PORT ?? 3000),
        corsOriginRaw: stubRawEnv.CORS_ORIGIN ?? "",
        trustProxyHops: Number(stubRawEnv.TRUST_PROXY_HOPS ?? 0),
        appRole: "api",
        isWorkerApp: false,
        isApiApp: true,
        getCorsConfig: () => emptyCors,
        getRedisConfig: () => defaultRedis,
        getCloudflareR2Config: () => defaultCloudflare,
        getSupabaseConfig: () => defaultSupabase,
        getFeedFetchConfig: () => defaultFeedFetch,
        getStorageConfig: () => defaultStorage,
        getGeminiConfig: () => defaultGemini,
        getOpenAiConfig: () => defaultOpenAi,
        getGoogleTtsConfig: () => defaultGoogleTts,
        getSupabaseAuthCacheConfig: () => defaultAuthCache,
        getDomainConfig: () => defaultDomain,
        getRuntimeFlag: (flagName, defaultValue = false) =>
            toBoolean(
                stubRawEnv[flagName] === undefined
                    ? undefined
                    : String(stubRawEnv[flagName]),
                defaultValue,
            ),
        getOptional: (key: string) => {
            const value = stubRawEnv[key];
            return value === undefined ? undefined : String(value);
        },
        toProcessEnvSnapshot: () => cloneEnv(stubRawEnv),
    };

    return {
        ...stubBase,
        ...overrides,
    };
}

export interface BuildTestAppEnvOptions {
    readonly injectDefaults?: boolean;
}

export function buildTestAppEnv(
    overrides: EnvOverrides = {},
    options: BuildTestAppEnvOptions = {},
): AppEnv {
    const snapshot = cloneEnv(process.env);
    if (options.injectDefaults !== false) {
        applyDefaults(snapshot);
    }
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) {
            delete snapshot[key];
        } else {
            snapshot[key] = value;
        }
    }
    return buildAppEnv(snapshot);
}

export function getTestAppEnv(): AppEnv {
    if (cachedAppEnv) {
        return cachedAppEnv;
    }
    return rebuildTestAppEnvCache();
}

export function readRuntimeFlag(
    flagName: string,
    defaultValue = false,
): boolean {
    return getTestAppEnv().getRuntimeFlag(flagName, defaultValue);
}

export function patchTestProcessEnv(updates: EnvOverrides): () => void {
    const previousEntries = new Map<string, string | undefined>();
    for (const key of Object.keys(updates)) {
        previousEntries.set(key, process.env[key]);
    }
    for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    resetTestAppEnv();
    return () => {
        for (const [key, value] of previousEntries.entries()) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
        resetTestAppEnv();
    };
}

export interface ResetTestAppEnvOptions {
    readonly restoreInitial?: boolean;
}

export function resetTestAppEnv(options: ResetTestAppEnvOptions = {}): void {
    cachedAppEnv = null;
    if (options.restoreInitial) {
        restoreProcessEnv(initialProcessEnvSnapshot);
    }
}

export function readRawEnv(key: string): string | undefined {
    return process.env[key];
}
