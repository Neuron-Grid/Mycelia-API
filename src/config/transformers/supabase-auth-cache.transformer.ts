import type { SupabaseAuthCacheConfig } from "@/config/app-env";

const DEFAULT_TTL_MS = 60_000;

export function buildSupabaseAuthCacheConfig(
    env: NodeJS.ProcessEnv,
): SupabaseAuthCacheConfig {
    const raw = env.SUPABASE_AUTH_CACHE_TTL_MS;
    const parsed = raw === undefined ? Number.NaN : Number(raw);
    const ttlMs =
        Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
    return {
        ttlMs,
    };
}
