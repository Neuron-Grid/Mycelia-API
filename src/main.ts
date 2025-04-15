import { ValidationPipe, VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
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

    await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
