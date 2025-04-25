import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { AppModule } from './app.module'

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
