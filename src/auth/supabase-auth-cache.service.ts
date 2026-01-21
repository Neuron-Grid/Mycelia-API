import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { APP_ENV_TOKEN, type AppEnv } from "@/config/app-env";
import { RedisService } from "@/shared/redis/redis.service";

type CacheEntry = {
    isDeleted: boolean;
    isSoftDeleted: boolean;
    expiresAt: number;
};

@Injectable()
export class SupabaseAuthCacheService implements OnModuleDestroy {
    private readonly logger = new Logger(SupabaseAuthCacheService.name);
    private readonly store = new Map<string, CacheEntry>();
    private readonly ttlMs: number;
    private readonly redisClient: ReturnType<RedisService["createMainClient"]>;
    private readonly redisKeyPrefix = "auth:status:";
    private readonly cleanupTimer: NodeJS.Timeout;

    constructor(
        @Inject(APP_ENV_TOKEN) private readonly appEnv: AppEnv,
        private readonly redisService: RedisService,
    ) {
        const { ttlMs } = this.appEnv.getSupabaseAuthCacheConfig();
        this.ttlMs = ttlMs;
        if (ttlMs === 60_000) {
            this.logger.debug(
                `Using default auth status cache TTL ${this.ttlMs}ms`,
            );
        }
        this.redisClient = this.redisService.createMainClient();
        this.cleanupTimer = setInterval(
            () => this.purgeExpiredEntries(),
            Math.min(this.ttlMs, 60_000),
        );
        if (typeof this.cleanupTimer.unref === "function") {
            this.cleanupTimer.unref();
        }
    }

    async get(userId: string): Promise<CacheEntry | null> {
        const entry = this.getFromMemory(userId);
        if (entry) {
            return entry;
        }

        return await this.getFromRedis(userId);
    }

    set(userId: string, payload: Omit<CacheEntry, "expiresAt">): void {
        const entry: CacheEntry = {
            ...payload,
            expiresAt: Date.now() + this.ttlMs,
        };
        this.store.set(userId, entry);

        const key = this.buildRedisKey(userId);
        const serialized = JSON.stringify(payload);
        void this.redisClient
            .set(key, serialized, "PX", this.ttlMs)
            .catch((error: Error) => {
                this.logger.warn(
                    `Failed to cache auth status in Redis: ${error.message}`,
                );
            });
    }

    evict(userId: string): void {
        this.store.delete(userId);
        const key = this.buildRedisKey(userId);
        void this.redisClient.del(key).catch((error: Error) => {
            this.logger.warn(
                `Failed to evict auth status from Redis: ${error.message}`,
            );
        });
    }

    async onModuleDestroy(): Promise<void> {
        clearInterval(this.cleanupTimer);
        const client = this.redisClient as unknown as {
            quit?: () => Promise<void>;
            disconnect?: () => void | Promise<void>;
        };
        if (typeof client.quit === "function") {
            await client.quit();
            return;
        }
        if (typeof client.disconnect === "function") {
            await client.disconnect();
        }
    }

    private buildRedisKey(userId: string): string {
        return `${this.redisKeyPrefix}${userId}`;
    }

    private getFromMemory(userId: string): CacheEntry | null {
        const entry = this.store.get(userId);
        if (!entry) return null;
        if (Date.now() >= entry.expiresAt) {
            this.store.delete(userId);
            return null;
        }
        return entry;
    }

    private async getFromRedis(userId: string): Promise<CacheEntry | null> {
        const key = this.buildRedisKey(userId);
        try {
            const raw = await this.redisClient.get(key);
            if (!raw) return null;
            const parsed = this.parseCachePayload(raw);
            if (!parsed) return null;
            const remainingTtl = await this.safePttl(key);
            const effectiveTtl =
                remainingTtl && remainingTtl > 0 ? remainingTtl : this.ttlMs;
            const entry: CacheEntry = {
                ...parsed,
                expiresAt: Date.now() + effectiveTtl,
            };
            this.store.set(userId, entry);
            return entry;
        } catch (error) {
            this.logger.warn(
                `Failed to read auth status from Redis: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            return null;
        }
    }

    private parseCachePayload(
        raw: string,
    ): Omit<CacheEntry, "expiresAt"> | null {
        try {
            const parsed = JSON.parse(raw) as {
                isDeleted?: unknown;
                isSoftDeleted?: unknown;
            };
            if (typeof parsed.isDeleted !== "boolean") {
                return null;
            }
            if (typeof parsed.isSoftDeleted !== "boolean") {
                return null;
            }
            return {
                isDeleted: parsed.isDeleted,
                isSoftDeleted: parsed.isSoftDeleted,
            };
        } catch {
            return null;
        }
    }

    private async safePttl(key: string): Promise<number | null> {
        try {
            const ttl = await this.redisClient.pttl(key);
            return typeof ttl === "number" ? ttl : null;
        } catch {
            return null;
        }
    }

    private purgeExpiredEntries(): void {
        const now = Date.now();
        for (const [userId, entry] of this.store.entries()) {
            if (entry.expiresAt <= now) {
                this.store.delete(userId);
            }
        }
    }
}
