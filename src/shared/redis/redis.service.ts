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

    // 共通オプションを1箇所で合成
    private base(): RedisOptions {
        return {
            host: this.opts.host,
            port: this.opts.port,
            password: this.opts.password,
            db: this.opts.db,
            tls: this.opts.tls,
            // BullMQ推奨設定を追加
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        }
    }

    // HealthControllerなどが使うメイン接続
    createMainClient(): Redis {
        return new Redis(this.base())
    }

    // Bull用クライアント
    // type毎に細かな違いを吸収
    createBullClient(type: 'client' | 'subscriber' | 'bclient' = 'client'): Redis {
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
