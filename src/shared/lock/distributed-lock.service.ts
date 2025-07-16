// src/shared/lock/distributed-lock.service.ts

import { randomBytes } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';
import { IDistributedLockService } from './distributed-lock.interface';

@Injectable()
export class DistributedLockService implements IDistributedLockService, OnModuleDestroy {
    private readonly redisClient: Redis;
    private readonly LUA_RELEASE_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

    constructor(private readonly redisService: RedisService) {
        this.redisClient = this.redisService.createMainClient();
    }

    /**
     * ロックを取得する
     * @param key ロック対象のキー
     * @param timeout ロックの有効期限 (ミリ秒)
     * @returns ロックID (成功時) / null (失敗時)
     */
    async acquire(key: string, timeout: number): Promise<string | null> {
        const lockId = randomBytes(16).toString('hex');
        const result = await this.redisClient.set(`lock:${key}`, lockId, 'PX', timeout, 'NX');
        return result === 'OK' ? lockId : null;
    }

    /**
     * ロックを解放する
     * @param key ロック対象のキー
     * @param lockId acquire時に取得したロックID
     * @returns true (解放成功) / false (解放失敗)
     */
    async release(key: string, lockId: string): Promise<boolean> {
        const result = await this.redisClient.eval(
            this.LUA_RELEASE_SCRIPT,
            1,
            `lock:${key}`,
            lockId,
        );
        return result === 1;
    }

    async onModuleDestroy() {
        await this.redisClient.quit();
    }
}
