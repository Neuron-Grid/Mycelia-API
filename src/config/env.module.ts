import { Global, Module } from "@nestjs/common";
import { APP_ENV_TOKEN, buildAppEnv } from "@/config/app-env";

@Global()
@Module({
    providers: [
        {
            provide: APP_ENV_TOKEN,
            useFactory: () => buildAppEnv(process.env),
        },
    ],
    exports: [APP_ENV_TOKEN],
})
export class EnvModule {}
