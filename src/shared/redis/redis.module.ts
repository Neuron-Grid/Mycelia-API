import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RedisService } from './redis.service'

// どのModuleからも使えるようにGlobalにする
@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: 'REDIS_CONNECTION_OPTIONS',
            useFactory: (config: ConfigService) => {
                // URL解決ロジック
                // 通常はREDIS_URL
                // HerokuはHEROKU_REDIS_*_URLが入る場合がある
                const url =
                    config.get<string>('REDIS_URL') ||
                    Object.entries(process.env).find(
                        ([k]) => k.startsWith('HEROKU_REDIS') && k.endsWith('_URL'),
                    )?.[1]

                if (!url) throw new Error('REDIS_URL is required')

                const u = new URL(url)

                // Heroku Redisは自己署名証明書
                const tls =
                    u.protocol === 'rediss:'
                        ? {
                              rejectUnauthorized: false,
                          }
                        : undefined

                return {
                    host: u.hostname,
                    port: Number(u.port) || 6379,
                    password: u.password || undefined,
                    db: u.pathname ? Number(u.pathname.slice(1) || 0) : 0,
                    tls,
                }
            },
            inject: [ConfigService],
        },
        RedisService,
    ],
    exports: ['REDIS_CONNECTION_OPTIONS', RedisService],
})
export class RedisModule {}
