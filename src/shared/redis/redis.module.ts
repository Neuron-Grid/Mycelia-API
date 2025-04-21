import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RedisService } from './redis.service'

@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: 'REDIS_CONNECTION_OPTIONS',
            useFactory: (config: ConfigService) => {
                // 必須扱い
                const url = config.get<string>('REDIS_URL')
                if (!url) throw new Error('REDIS_URL is required')
                const u = new URL(url)
                return {
                    host: u.hostname,
                    port: Number(u.port) || 6379,
                    // パスワード未指定ならundefinedのまま渡す
                    password: u.password || undefined,
                    db: u.pathname ? Number(u.pathname.slice(1) || 0) : 0,
                    // rediss://の場合だけTLSオプションを付与
                    tls: u.protocol === 'rediss:' ? {} : undefined,
                }
            },
            inject: [ConfigService],
        },
        RedisService,
    ],
    exports: ['REDIS_CONNECTION_OPTIONS', RedisService],
})
export class RedisModule {}
