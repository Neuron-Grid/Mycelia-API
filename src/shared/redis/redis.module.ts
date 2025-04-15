import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RedisService } from './redis.service'

// "REDIS_CONNECTION_OPTIONS" というトークンで
// Redis接続に必要なオプションhost, port, password等を一元管理
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: 'REDIS_CONNECTION_OPTIONS',
            useFactory: (configService: ConfigService) => {
                // ConfigService から環境変数を読み込んで返す
                return {
                    host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
                    port: configService.get<number>('REDIS_PORT', 6379),
                    // password: configService.get<string>('REDIS_PASSWORD', ''),
                }
            },
            inject: [ConfigService],
        },
        RedisService,
    ],
    exports: ['REDIS_CONNECTION_OPTIONS', RedisService],
})
export class RedisModule {}
