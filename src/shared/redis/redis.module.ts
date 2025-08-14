import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RedisService } from "./redis.service";

// どのModuleからも使えるようにGlobalにする
@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: "REDIS_CONNECTION_OPTIONS",
            useFactory: (config: ConfigService) => {
                // 必須: REDIS_URL のみを使用（Heroku固有検出は廃止）
                const url = config.get<string>("REDIS_URL");
                if (!url) throw new Error("REDIS_URL is required");

                const u = new URL(url);

                // TLS は rediss:// の場合のみ有効化（自己署名の特別対応は行わない）
                const tls = u.protocol === "rediss:" ? {} : undefined;

                return {
                    host: u.hostname,
                    port: Number(u.port) || 6379,
                    password: u.password || undefined,
                    db: u.pathname ? Number(u.pathname.slice(1) || 0) : 0,
                    tls,
                };
            },
            inject: [ConfigService],
        },
        RedisService,
    ],
    exports: ["REDIS_CONNECTION_OPTIONS", RedisService],
})
export class RedisModule {}
