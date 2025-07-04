// src/shared/lock/distributed-lock.interface.ts
export interface IDistributedLockService {
    acquire(key: string, timeout: number): Promise<string | null>
    release(key: string, lockId: string): Promise<boolean>
}
