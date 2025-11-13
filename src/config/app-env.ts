import type { ClusterNode, ClusterOptions, RedisOptions } from "ioredis";
import { validateEnv } from "@/config/env.validation";
import { buildCloudflareR2Config } from "@/config/transformers/cloudflare-r2.transformer";
import { buildCorsConfig } from "@/config/transformers/cors.transformer";
import { buildDomainConfig } from "@/config/transformers/domain.transformer";
import { buildFeedFetchConfig } from "@/config/transformers/feed-fetch.transformer";
import { buildGeminiConfig } from "@/config/transformers/gemini.transformer";
import { buildGoogleTtsConfig } from "@/config/transformers/google-tts.transformer";
import { buildOpenAiConfig } from "@/config/transformers/openai.transformer";
import { buildRedisConfig } from "@/config/transformers/redis.transformer";
import { buildStorageConfig } from "@/config/transformers/storage.transformer";
import { buildSupabaseConfig } from "@/config/transformers/supabase.transformer";
import { buildSupabaseAuthCacheConfig } from "@/config/transformers/supabase-auth-cache.transformer";

export const APP_ENV_TOKEN = Symbol("APP_ENV_TOKEN");

export interface CorsConfig {
    readonly origins: string[];
    readonly credentials: boolean;
}

export type RedisConnectionConfig =
    | {
          readonly mode: "single";
          readonly options: RedisOptions;
      }
    | {
          readonly mode: "cluster";
          readonly nodes: ClusterNode[];
          readonly options: ClusterOptions;
      };

export interface CloudflareR2Config {
    readonly accountId: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly bucketName: string;
    readonly publicDomain: string;
    readonly allowedBuckets: string[];
    readonly allowedPrefixTemplates: string[];
}

export interface SupabaseConfig {
    readonly url: string;
    readonly anonKey: string;
    readonly serviceRoleKey: string;
}

export interface FeedFetchConfig {
    readonly allowHttp: boolean;
    readonly userAgent: string;
    readonly connectTimeoutMs: number;
    readonly responseTimeoutMs: number;
    readonly bodyIdleTimeoutMs: number;
    readonly totalTimeoutMs: number;
    readonly maxRedirects: number;
    readonly maxBytes: number;
    readonly extraDenyCidrsRaw: string;
}

export interface StorageConfig {
    readonly supabaseUploadEnabled: boolean;
}

export interface GeminiConfig {
    readonly apiKey: string;
    readonly apiUrl: string;
}

export interface OpenAiConfig {
    readonly apiKey: string;
    readonly baseUrl: string;
}

export interface GoogleTtsConfig {
    readonly inlineCredentialsRaw?: string;
    readonly credentialsFile?: string;
}

export interface SupabaseAuthCacheConfig {
    readonly ttlMs: number;
}

export interface DomainConfig {
    readonly frontOrigin?: string;
    readonly productionDomain?: string;
}

export interface AppEnv {
    readonly nodeEnv: string;
    readonly port: number;
    readonly corsOriginRaw: string;
    readonly trustProxyHops: number;
    readonly appRole: "api" | "worker";
    readonly isWorkerApp: boolean;
    readonly isApiApp: boolean;

    getCorsConfig(): CorsConfig;
    getRedisConfig(): RedisConnectionConfig;
    getCloudflareR2Config(): CloudflareR2Config;
    getSupabaseConfig(): SupabaseConfig;
    getFeedFetchConfig(): FeedFetchConfig;
    getStorageConfig(): StorageConfig;
    getGeminiConfig(): GeminiConfig;
    getOpenAiConfig(): OpenAiConfig;
    getGoogleTtsConfig(): GoogleTtsConfig;
    getSupabaseAuthCacheConfig(): SupabaseAuthCacheConfig;
    getDomainConfig(): DomainConfig;
    getRuntimeFlag(flagName: string, defaultValue?: boolean): boolean;
    getOptional(key: string): string | undefined;
    toProcessEnvSnapshot(): NodeJS.ProcessEnv;
}

interface AppEnvCache {
    cors?: CorsConfig;
    redis?: RedisConnectionConfig;
    cloudflare?: CloudflareR2Config;
    supabase?: SupabaseConfig;
    feedFetch?: FeedFetchConfig;
    storage?: StorageConfig;
    gemini?: GeminiConfig;
    openAi?: OpenAiConfig;
    googleTts?: GoogleTtsConfig;
    supabaseAuthCache?: SupabaseAuthCacheConfig;
    domain?: DomainConfig;
}

export interface BuildAppEnvOptions {
    readonly argv?: readonly string[];
}

export function resolveNodeEnvironment(env: NodeJS.ProcessEnv): string {
    return (env.NODE_ENV?.trim() ?? "development").toLowerCase();
}

class AppEnvImpl implements AppEnv {
    public readonly nodeEnv: string;
    public readonly port: number;
    public readonly corsOriginRaw: string;
    public readonly trustProxyHops: number;
    public readonly appRole: "api" | "worker";
    public readonly isWorkerApp: boolean;
    public readonly isApiApp: boolean;

    private readonly env: NodeJS.ProcessEnv;
    private readonly cache: AppEnvCache = {};

    constructor(env: NodeJS.ProcessEnv, argv: readonly string[]) {
        this.env = env;
        this.nodeEnv = resolveNodeEnvironment(env);
        this.port = parsePort(env.PORT, 3000);
        this.corsOriginRaw = env.CORS_ORIGIN?.trim() ?? "";
        this.trustProxyHops = parsePositiveInt(env.TRUST_PROXY_HOPS, 0);
        this.appRole = deriveAppRole(env, argv);
        this.isWorkerApp = this.appRole === "worker";
        this.isApiApp = this.appRole === "api";
    }

    public getCorsConfig(): CorsConfig {
        if (!this.cache.cors) {
            this.cache.cors = buildCorsConfig(this.env);
        }
        const cached = this.cache.cors;
        return {
            origins: [...cached.origins],
            credentials: cached.credentials,
        };
    }

    public getRedisConfig(): RedisConnectionConfig {
        if (!this.cache.redis) {
            this.cache.redis = buildRedisConfig(this.env);
        }
        return cloneRedisConfig(this.cache.redis);
    }

    public getCloudflareR2Config(): CloudflareR2Config {
        if (!this.cache.cloudflare) {
            this.cache.cloudflare = buildCloudflareR2Config(this.env);
        }
        const cached = this.cache.cloudflare;
        return {
            accountId: cached.accountId,
            accessKeyId: cached.accessKeyId,
            secretAccessKey: cached.secretAccessKey,
            bucketName: cached.bucketName,
            publicDomain: cached.publicDomain,
            allowedBuckets: [...cached.allowedBuckets],
            allowedPrefixTemplates: [...cached.allowedPrefixTemplates],
        };
    }

    public getSupabaseConfig(): SupabaseConfig {
        if (!this.cache.supabase) {
            this.cache.supabase = buildSupabaseConfig(this.env);
        }
        const cached = this.cache.supabase;
        return {
            url: cached.url,
            anonKey: cached.anonKey,
            serviceRoleKey: cached.serviceRoleKey,
        };
    }

    public getFeedFetchConfig(): FeedFetchConfig {
        if (!this.cache.feedFetch) {
            this.cache.feedFetch = buildFeedFetchConfig(this.env);
        }
        const cached = this.cache.feedFetch;
        return {
            allowHttp: cached.allowHttp,
            userAgent: cached.userAgent,
            connectTimeoutMs: cached.connectTimeoutMs,
            responseTimeoutMs: cached.responseTimeoutMs,
            bodyIdleTimeoutMs: cached.bodyIdleTimeoutMs,
            totalTimeoutMs: cached.totalTimeoutMs,
            maxRedirects: cached.maxRedirects,
            maxBytes: cached.maxBytes,
            extraDenyCidrsRaw: cached.extraDenyCidrsRaw,
        };
    }

    public getStorageConfig(): StorageConfig {
        if (!this.cache.storage) {
            this.cache.storage = buildStorageConfig(this.env);
        }
        const cached = this.cache.storage;
        return {
            supabaseUploadEnabled: cached.supabaseUploadEnabled,
        };
    }

    public getGeminiConfig(): GeminiConfig {
        if (!this.cache.gemini) {
            this.cache.gemini = buildGeminiConfig(this.env);
        }
        const cached = this.cache.gemini;
        return {
            apiKey: cached.apiKey,
            apiUrl: cached.apiUrl,
        };
    }

    public getOpenAiConfig(): OpenAiConfig {
        if (!this.cache.openAi) {
            this.cache.openAi = buildOpenAiConfig(this.env);
        }
        const cached = this.cache.openAi;
        return {
            apiKey: cached.apiKey,
            baseUrl: cached.baseUrl,
        };
    }

    public getGoogleTtsConfig(): GoogleTtsConfig {
        if (!this.cache.googleTts) {
            this.cache.googleTts = buildGoogleTtsConfig(this.env);
        }
        const cached = this.cache.googleTts;
        return {
            inlineCredentialsRaw: cached.inlineCredentialsRaw,
            credentialsFile: cached.credentialsFile,
        };
    }

    public getSupabaseAuthCacheConfig(): SupabaseAuthCacheConfig {
        if (!this.cache.supabaseAuthCache) {
            this.cache.supabaseAuthCache = buildSupabaseAuthCacheConfig(
                this.env,
            );
        }
        const cached = this.cache.supabaseAuthCache;
        return {
            ttlMs: cached.ttlMs,
        };
    }

    public getDomainConfig(): DomainConfig {
        if (!this.cache.domain) {
            this.cache.domain = buildDomainConfig(this.env);
        }
        const cached = this.cache.domain;
        return {
            frontOrigin: cached.frontOrigin,
            productionDomain: cached.productionDomain,
        };
    }

    public getRuntimeFlag(flagName: string, defaultValue = false): boolean {
        const rawValue = this.env[flagName];
        if (rawValue === undefined || rawValue === null) {
            return defaultValue;
        }
        const normalized = String(rawValue).trim().toLowerCase();
        if (normalized.length === 0) {
            return defaultValue;
        }
        return RUNTIME_TRUTHY_VALUES.has(normalized);
    }

    public getOptional(key: string): string | undefined {
        const rawValue = this.env[key];
        return rawValue === undefined || rawValue === null
            ? undefined
            : String(rawValue);
    }

    public toProcessEnvSnapshot(): NodeJS.ProcessEnv {
        return cloneEnv(this.env);
    }
}

export function buildAppEnv(
    envInput: NodeJS.ProcessEnv,
    options?: BuildAppEnvOptions,
): AppEnv {
    const snapshot = cloneEnv(envInput);
    validateEnv(snapshot);
    const argv = options?.argv ?? process.argv;
    return new AppEnvImpl(snapshot, argv);
}

function cloneEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return Object.fromEntries(
        Object.entries(env).map(([key, value]) => [key, value]),
    ) as NodeJS.ProcessEnv;
}

function parsePort(value: string | undefined, fallback: number): number {
    const parsed = value ? Number(value) : Number.NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.trunc(parsed);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = value ? Number(value) : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }
    return Math.trunc(parsed);
}

function deriveAppRole(
    env: NodeJS.ProcessEnv,
    argv: readonly string[],
): "api" | "worker" {
    const explicit = env.APP_ROLE?.trim().toLowerCase();
    if (explicit === "api" || explicit === "worker") {
        return explicit;
    }

    const lifecycle = env.npm_lifecycle_event?.toLowerCase() ?? "";
    if (lifecycle.includes("worker")) {
        return "worker";
    }
    if (lifecycle.includes("api")) {
        return "api";
    }

    const scriptCandidate = argv[1]?.toLowerCase() ?? "";
    if (scriptCandidate.includes("worker")) {
        return "worker";
    }

    return "api";
}

function cloneRedisConfig(
    source: RedisConnectionConfig,
): RedisConnectionConfig {
    if (source.mode === "single") {
        return {
            mode: "single",
            options: cloneRedisOptions(source.options),
        };
    }
    return {
        mode: "cluster",
        nodes: source.nodes.map((node) => cloneClusterNode(node)),
        options: cloneClusterOptions(source.options),
    };
}

function cloneRedisOptions(options: RedisOptions): RedisOptions {
    const cloned: RedisOptions = { ...options };
    if (options.tls) {
        cloned.tls = { ...options.tls };
    }
    return cloned;
}

function cloneClusterOptions(options: ClusterOptions): ClusterOptions {
    const cloned: ClusterOptions = { ...options };
    if (options.redisOptions) {
        cloned.redisOptions = cloneRedisOptions(options.redisOptions);
    }
    return cloned;
}

function cloneClusterNode(node: ClusterNode): ClusterNode {
    if (typeof node === "string") {
        return node;
    }
    if (Array.isArray(node)) {
        const [host, port] = node;
        return [host, port] as ClusterNode;
    }
    return { ...(node as Record<string, unknown>) } as ClusterNode;
}

const RUNTIME_TRUTHY_VALUES = new Set<string>(["1", "true", "yes", "on"]);
