import * as fs from 'node:fs'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { dump } from 'js-yaml'
import { AppModule } from './app.module'

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    // helmet ミドルウェアを適用
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    // デフォルトのソースを自身のオリジンに限定
                    defaultSrc: ["'self'"],
                    // スクリプトのソースを自身のオリジンに限定
                    scriptSrc: ["'self'"],
                    // スタイルは自身のオリジンとインラインを許可
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    // 画像は自身のオリジンとdata URIを許可
                    imgSrc: ["'self'", 'data:'],
                    // API接続などを自身のオリジンに限定
                    connectSrc: ["'self'"],
                    // フォントは自身のオリジンに限定
                    fontSrc: ["'self'"],
                    // <object>などを禁止
                    objectSrc: ["'none'"],
                    // iframe埋め込みを禁止 (クリックジャッキング対策)
                    frameAncestors: ["'none'"],
                    // HTTPをHTTPSにアップグレード
                    upgradeInsecureRequests: [],
                },
            },
        }),
    )
    // CORS を有効化
    app.enableCors()
    // すべてのルートに/apiプレフィックスを追加
    app.setGlobalPrefix('api')
    // バージョニングを有効化
    // /URIベース /v1 をデフォルトにする
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    })

    // ここでグローバルのValidationPipeを設定
    app.useGlobalPipes(
        new ValidationPipe({
            // DTOに含まれていないプロパティは弾く
            whitelist: true,
            // whitelistにないプロパティが来たらエラーにする場合はtrue
            forbidNonWhitelisted: true,
            // 受け取ったPayloadを自動的にDTOクラスへ変換
            transform: true,
        }),
    )

    const config = new DocumentBuilder()
        .setTitle('Sample NestJS API')
        .setDescription('An example NestJS project with Supabase integration')
        .setVersion('1.0.0')
        // JWT の Bearer 認証を使う場合は以下を有効化
        .addBearerAuth()
        .build()

    const document = SwaggerModule.createDocument(app, config)
    // `/api-docs` で Swagger UI を表示
    SwaggerModule.setup('api-docs', app, document)

    // YAML で swagger.yaml を出力
    const yamlData = dump(document)
    fs.writeFileSync('swagger.yaml', yamlData, 'utf8')

    await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
