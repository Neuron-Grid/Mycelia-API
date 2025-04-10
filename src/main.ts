import { VersioningType } from '@nestjs/common'
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
    await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
