import { Global, Module } from "@nestjs/common";
import { APP_ENV_TOKEN, buildAppEnv } from "@/config/app-env";
import { ensureEnvLoaded } from "@/config/ensure-env";

@Global()
@Module({
    providers: [
        {
            provide: APP_ENV_TOKEN,
            useFactory: () => {
                ensureEnvLoaded();
                return buildAppEnv(process.env);
            },
        },
    ],
    exports: [APP_ENV_TOKEN],
})
export class EnvModule {}
