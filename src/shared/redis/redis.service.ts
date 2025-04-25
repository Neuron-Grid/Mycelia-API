import { Inject, Injectable } from '@nestjs/common'
import Redis, { RedisOptions } from 'ioredis'

type ConnOpts = {
    host: string
    port: number
    password?: string
    db?: number
    tls?: RedisOptions['tls']
}

@Injectable()
export class RedisService {
    constructor(
        @Inject('REDIS_CONNECTION_OPTIONS')
        private readonly opts: ConnOpts,
    ) {}

    /** 共通オプションを 1 箇所で合成 */
    private base(): RedisOptions {
        return {
            host: this.opts.host,
            port: this.opts.port,
            password: this.opts.password,
            db: this.opts.db,
            tls: this.opts.tls,
        }
    }

    /** HealthController などが使うメイン接続 */
    createMainClient(): Redis {
        return new Redis(this.base())
    }

    /** Bull 用クライアント (type 毎に細かな違いを吸収) */
    createBullClient(type: 'client' | 'subscriber' | 'bclient'): Redis {
        switch (type) {
            case 'client':
                return new Redis(this.base())

            default:
                return new Redis({
                    ...this.base(),
                    enableReadyCheck: false,
                    maxRetriesPerRequest: null,
                })
        }
    }
}
