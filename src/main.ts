// @file NestJSアプリケーションのエントリポイント
import { ValidationPipe } from '@nestjs/common'
// @see https://docs.nestjs.com/techniques/configuration
import { ConfigService } from '@nestjs/config'
// @see https://docs.nestjs.com/
import { NestFactory } from '@nestjs/core'
// @see https://www.npmjs.com/package/helmet
import helmet from 'helmet'
// @see ./app.module
import { AppModule } from './app.module'

// @async
// @since 1.0.0
// @returns {Promise<void>} - サーバ起動のPromise
// @throws {Error} - 初期化や起動に失敗した場合
// @example
// bootstrap()
// @see https://docs.nestjs.com/
async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    // config
    const cfg = app.get(ConfigService)
    const allowed = (cfg.get<string>('CORS_ORIGIN') ?? '').split(' ')
    app.enableCors({ origin: allowed, credentials: true })

    // helmet
    app.use(helmet())

    // global settings
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    app.setGlobalPrefix('api/v1')
    app.getHttpAdapter()
        .getInstance()
        .set('trust proxy', Number(cfg.get<number>('TRUST_PROXY_HOPS') || 0))
    app.enableShutdownHooks()

    // swagger
    if (cfg.get('NODE_ENV') === 'development') {
        const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger')
        const config = new DocumentBuilder()
            .setTitle('API Documentation')
            .setDescription('API Documentation')
            .setVersion('1.0')
            .addBearerAuth()
            .build()
        const document = SwaggerModule.createDocument(app, config)
        SwaggerModule.setup('api/docs', app, document)
    }

    // start server
    await app.listen(process.env.PORT ?? 3000, '0.0.0.0')
}
bootstrap()
