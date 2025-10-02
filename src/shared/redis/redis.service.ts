import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis, { RedisOptions } from "ioredis";

type ConnOpts = {
    host: string;
    port: number;
    password?: string;
    db?: number;
    tls?: RedisOptions["tls"];
};

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private healthClient?: Redis;

    constructor(
        @Inject("REDIS_CONNECTION_OPTIONS")
        private readonly opts: ConnOpts,
    ) {}

    // 共通オプションを1箇所で合成
    private base(): RedisOptions {
        return {
            host: this.opts.host,
            port: this.opts.port,
            password: this.opts.password,
            db: this.opts.db,
            tls: this.opts.tls,
            // BullMQ推奨設定を追加
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };
    }

    // HealthControllerなどが使うメイン接続
    createMainClient(): Redis {
        return new Redis(this.base());
    }

    getHealthClient(): Redis {
        if (!this.healthClient) {
            this.healthClient = this.createHealthClient();
        }
        return this.healthClient;
    }

    private createHealthClient(): Redis {
        const client = new Redis(this.base());
        client.on("error", (error: Error) => {
            this.logger.warn(`Redis health client error: ${error.message}`);
        });
        return client;
    }

    // Bull用クライアント
    // type毎に細かな違いを吸収
    createBullClient(
        type: "client" | "subscriber" | "bclient" = "client",
    ): Redis {
        switch (type) {
            case "client":
                return new Redis(this.base());

            default:
                return new Redis({
                    ...this.base(),
                    enableReadyCheck: false,
                    maxRetriesPerRequest: null,
                });
        }
    }

    async onModuleDestroy(): Promise<void> {
        const clients: Array<Redis | undefined> = [this.healthClient];
        for (const client of clients) {
            if (!client) continue;
            try {
                await client.quit();
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                this.logger.warn(
                    `Failed to close Redis client gracefully: ${message}`,
                );
            }
        }
    }
}
