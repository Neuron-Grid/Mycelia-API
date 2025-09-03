import { ValidationPipe } from "@nestjs/common";
// @see https://docs.nestjs.com/techniques/configuration
import { ConfigService } from "@nestjs/config";
// @see https://docs.nestjs.com/
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
// @see https://www.npmjs.com/package/helmet
import helmet from "helmet";
import {
    createCsrfMiddleware,
    createHttpsEnforceMiddleware,
} from "@/common/middleware/security.middleware";
// @see ./app.module
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";

// @async
// @since 1.0.0
// @returns {Promise<void>} - サーバ起動のPromise
// @throws {Error} - 初期化や起動に失敗した場合
// @example
// bootstrap()
// @see https://docs.nestjs.com/
async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // config
    const cfg = app.get(ConfigService);
    const originsRaw = cfg.get<string>("CORS_ORIGIN")?.trim() ?? "";
    const allowed = originsRaw.length
        ? originsRaw.split(/\s+/).filter(Boolean)
        : [];
    app.enableCors({
        origin: allowed.length ? allowed : false,
        credentials: true,
    });

    // helmet + HSTS 強化（prod環境のみ preload/subdomainsを有効化）
    const isProd =
        (cfg.get<string>("NODE_ENV") || "").toLowerCase() === "production";
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
    app.use(createHttpsEnforceMiddleware(cfg));
    // Double submit cookie 方式の CSRF 対策
    app.use(createCsrfMiddleware(cfg));

    // global settings
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix("api/v1");
    app.getHttpAdapter()
        .getInstance()
        .set("trust proxy", Number(cfg.get<number>("TRUST_PROXY_HOPS") || 0));
    app.enableShutdownHooks();

    // OpenAPIは開発時に nestia で静的生成（swagger.json）し、
    // ランタイムでの @nestjs/swagger による生成・出力は行わない。

    // start server
    const port = Number(cfg.get<string>("PORT")) || 3000;
    await app.listen(port, "0.0.0.0");
}
bootstrap();
