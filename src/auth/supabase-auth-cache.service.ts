import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_ENV_TOKEN, type AppEnv } from "@/config/app-env";

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

    constructor(@Inject(APP_ENV_TOKEN) private readonly appEnv: AppEnv) {
        const { ttlMs } = this.appEnv.getSupabaseAuthCacheConfig();
        this.ttlMs = ttlMs;
        if (ttlMs === 60_000) {
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
