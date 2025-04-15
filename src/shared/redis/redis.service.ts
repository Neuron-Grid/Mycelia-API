import { Inject, Injectable } from '@nestjs/common'
import Redis from 'ioredis'

@Injectable()
export class RedisService {
    constructor(
        @Inject('REDIS_CONNECTION_OPTIONS')
        private readonly redisOptions: {
            host: string
            port: number
            password?: string
        },
    ) {}

    // HealthController等が使うメイン接続
    public createMainClient(): Redis {
        return new Redis({
            host: this.redisOptions.host,
            port: this.redisOptions.port,
            password: this.redisOptions.password,
        })
    }

    // BullのQueue用クライアントを生成
    // typeに応じてenableReadyCheck, maxRetriesPerRequestなどを調整
    public createBullClient(type: 'client' | 'subscriber' | 'bclient'): Redis {
        const baseOptions = {
            host: this.redisOptions.host,
            port: this.redisOptions.port,
            password: this.redisOptions.password,
        }

        // type別にオプションを切り替える
        switch (type) {
            case 'client':
                // client用はデフォルトでも問題ないことが多い
                return new Redis({
                    ...baseOptions,
                    // 必要ならここにクライアント専用オプションを追加
                })

            case 'subscriber':
            case 'bclient':
                // subscriberやbclient用はBullの制限でenableReadyCheck=false / maxRetriesPerRequest=null
                return new Redis({
                    ...baseOptions,
                    enableReadyCheck: false,
                    maxRetriesPerRequest: null,
                })

            default:
                // 念のためdefaultでも同様に対処しておく
                return new Redis({
                    ...baseOptions,
                    enableReadyCheck: false,
                    maxRetriesPerRequest: null,
                })
        }
    }
}
