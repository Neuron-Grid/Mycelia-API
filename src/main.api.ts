import { ValidationPipe } from "@nestjs/common";
// @see https://docs.nestjs.com/techniques/configuration
// @see https://docs.nestjs.com/
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
// @see https://www.npmjs.com/package/helmet
import helmet from "helmet";
// @see ./app.api.module
import { AppApiModule } from "@/app.api.module";
import { createRequestLoggingMiddleware } from "@/common/middleware/request-logging.middleware";
import {
    createCsrfMiddleware,
    createHttpsEnforceMiddleware,
} from "@/common/middleware/security.middleware";
import { APP_ENV_TOKEN, type AppEnv } from "@/config/app-env";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";

// @async
// @since 1.0.0
// @returns {Promise<void>} - サーバ起動のPromise
// @throws {Error} - 初期化や起動に失敗した場合
// @example
// bootstrap()
// @see https://docs.nestjs.com/
async function bootstrap() {
    const app = await NestFactory.create(AppApiModule);

    // config
    const appEnv = app.get<AppEnv>(APP_ENV_TOKEN);
    const corsConfig = appEnv.getCorsConfig();
    app.enableCors({
        origin: corsConfig.origins.length ? corsConfig.origins : false,
        credentials: corsConfig.credentials,
    });

    // request id + access logging
    app.use(createRequestLoggingMiddleware());

    // helmet + HSTS 強化（prod環境のみ preload/subdomainsを有効化）
    const isProd = appEnv.nodeEnv === "production";
    app.use(
        helmet({
            hsts: isProd
                ? {
                      maxAge: 15552000, // 180 days
                      includeSubDomains: true,
                      preload: true,
                  }
                : undefined,
        }),
    );
    // cookie
    app.use(cookieParser());
    // HTTPS 強制（proxy 配下想定）
    app.use(createHttpsEnforceMiddleware(appEnv));
    // Double submit cookie 方式の CSRF 対策
    app.use(createCsrfMiddleware(appEnv));

    // global settings
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(appEnv));
    app.setGlobalPrefix("api/v1");
    app.getHttpAdapter()
        .getInstance()
        .set("trust proxy", appEnv.trustProxyHops);
    app.enableShutdownHooks();

    // OpenAPIは開発時に nestia で静的生成（swagger.json）し、
    // ランタイムでの @nestjs/swagger による生成・出力は行わない。

    // start server
    const port = appEnv.port;
    await app.listen(port, "0.0.0.0");
}
bootstrap();
