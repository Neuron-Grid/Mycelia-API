import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ValidationPipe } from "@nestjs/common";
// @see https://docs.nestjs.com/techniques/configuration
import { ConfigService } from "@nestjs/config";
// @see https://docs.nestjs.com/
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
// @see https://www.npmjs.com/package/helmet
import helmet from "helmet";
import { dump as yamlDump } from "js-yaml";
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

    // Swagger（nestjs版）の生成は開発環境のみ
    if (cfg.get("NODE_ENV") === "development") {
        const { SwaggerModule, DocumentBuilder } = await import(
            "@nestjs/swagger"
        );
        const swaggerConfig = new DocumentBuilder()
            .setTitle("API Documentation")
            .setDescription("API Documentation")
            .setVersion("1.0")
            .addBearerAuth()
            .build();
        const swaggerDocument = SwaggerModule.createDocument(
            app,
            swaggerConfig,
        );

        // 出力パスは固定（devのみ）
        // Nestia 生成の swagger.yaml と衝突しないように別名に変更
        const outPath = resolve(process.cwd(), "swagger.nestjs.yaml");

        try {
            const yaml = yamlDump(swaggerDocument);
            // 明示的にencoding/flagを指定
            // 安全側の上書き
            writeFileSync(outPath, yaml, { encoding: "utf8", flag: "w" });
        } catch (err) {
            // 生成失敗時もアプリ起動は継続させるが、開発環境のみ警告
            const e = err as NodeJS.ErrnoException;
            const message = e?.message ?? String(e);

            // NodeのWarning機構
            process.emitWarning(
                `[Swagger] Failed to generate swagger.yaml: ${message}`,
                {
                    type: "SwaggerGenerationWarning",
                    code: "SWAGGER_YAML_WRITE_FAILED",
                    detail: `path=${outPath}${e?.code ? `; errno=${e.code}` : ""}`,
                },
            );

            // 標準の警告出力
            console.warn(
                `[Swagger] Failed to generate swagger.yaml. The application will continue to start.\n` +
                    `  path: ${outPath}\n` +
                    (e?.code ? `  code: ${e.code}\n` : "") +
                    `  message: ${message}\n` +
                    `  hint: Check write permissions for the output directory, available disk space, and your @nestjs/swagger configuration.`,
            );
        }

        // Swagger UIは開発環境のみで有効化
        SwaggerModule.setup("api/docs", app, swaggerDocument);
    }

    // start server
    const port = Number(cfg.get<string>("PORT")) || 3000;
    await app.listen(port, "0.0.0.0");
}
bootstrap();
