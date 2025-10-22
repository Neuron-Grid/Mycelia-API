import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type CacheEntry = {
    isDeleted: boolean;
    isSoftDeleted: boolean;
    expiresAt: number;
};

@Injectable()
export class SupabaseAuthCacheService {
    private readonly logger = new Logger(SupabaseAuthCacheService.name);
    private readonly store = new Map<string, CacheEntry>();
    private readonly ttlMs: number;

    constructor(private readonly config: ConfigService) {
        const rawTtl = this.config.get<string | number>(
            "SUPABASE_AUTH_CACHE_TTL_MS",
        );
        const parsed =
            typeof rawTtl === "number"
                ? rawTtl
                : typeof rawTtl === "string"
                  ? Number.parseInt(rawTtl, 10)
                  : Number.NaN;
        this.ttlMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
        if (!Number.isFinite(parsed) || parsed <= 0) {
            this.logger.debug(
                `Using default auth status cache TTL ${this.ttlMs}ms`,
            );
        }
    }

    get(userId: string): CacheEntry | null {
        const entry = this.store.get(userId);
        if (!entry) return null;
        if (Date.now() >= entry.expiresAt) {
            this.store.delete(userId);
            return null;
        }
        return entry;
    }

    set(userId: string, payload: Omit<CacheEntry, "expiresAt">): void {
        this.store.set(userId, {
            ...payload,
            expiresAt: Date.now() + this.ttlMs,
        });
    }

    evict(userId: string): void {
        this.store.delete(userId);
    }
}
