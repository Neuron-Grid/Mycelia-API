import { Global, Module } from "@nestjs/common";
import {
    APP_ENV_TOKEN,
    type AppEnv,
    type RedisConnectionConfig,
} from "@/config/app-env";
import { RedisService } from "./redis.service";

@Global()
@Module({
    providers: [
        {
            provide: "REDIS_CONNECTION_OPTIONS",
            useFactory: (appEnv: AppEnv): RedisConnectionConfig =>
                appEnv.getRedisConfig(),
            inject: [APP_ENV_TOKEN],
        },
        RedisService,
    ],
    exports: ["REDIS_CONNECTION_OPTIONS", RedisService],
})
export class RedisModule {}
