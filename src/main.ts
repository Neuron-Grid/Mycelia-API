import * as fs from 'node:fs'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Express } from 'express'
import helmet from 'helmet'
import { dump } from 'js-yaml'
import { AppModule } from './app.module'

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    const cfg = app.get(ConfigService)

    // Helmet
    const frontOrigin = cfg.get<string>('FRONT_ORIGIN') ?? ''
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", 'data:', frontOrigin],
                    connectSrc: ["'self'", frontOrigin],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    frameAncestors: ["'none'"],
                    upgradeInsecureRequests: [],
                },
            },
        }),
    )

    // CORS
    const corsEnv = cfg.get<string>('CORS_ORIGIN') ?? ''
    const corsOrigins = corsEnv.split(/[\s,]+/).filter(Boolean)
    if (corsOrigins.length > 0) {
        // CORS_ORIGIN が 1 つ以上指定されている場合
        app.enableCors({
            origin: corsOrigins,
            credentials: true,
        })
    } else {
        // 指定がなければデフォルト設定
        // すべてのオリジンを許可
        app.enableCors()
    }

    // trust proxy
    // Express
    const hops = Number(cfg.get<string>('TRUST_PROXY_HOPS') ?? 1)
    const expressApp = app.getHttpAdapter().getInstance() as Express
    expressApp.set('trust proxy', hops)

    // Prefix / Versioning
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

    // Validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )

    // Swagger
    const swaggerCfg = new DocumentBuilder()
        .setTitle('RSS News API')
        .setDescription('NestJS + Supabase implementation')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build()
    const swaggerDoc = SwaggerModule.createDocument(app, swaggerCfg)
    SwaggerModule.setup('api-docs', app, swaggerDoc)
    fs.writeFileSync('swagger.yaml', dump(swaggerDoc), 'utf8')

    const port = Number(cfg.get<string>('PORT') ?? 3000)
    await app.listen(port)
}

bootstrap()
