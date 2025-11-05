import type { QueueOptionsLike } from "@nestjs/bullmq";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AccountDeletionQueueProcessor } from "@/account-deletion/account-deletion.processor";
import { AccountDeletionService } from "@/account-deletion/account-deletion.service";
import { AuthModule } from "@/auth/auth.module";
import { PodcastCoreModule } from "@/podcast/core/podcast-core.module";
import { DistributedLockModule } from "@/shared/lock/distributed-lock.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { RedisService } from "@/shared/redis/redis.service";

@Module({
    imports: [
        RedisModule,
        AuthModule,
        PodcastCoreModule, // CloudflareR2Service を提供
        DistributedLockModule,
        BullModule.registerQueueAsync({
            name: "accountDeletionQueue",
            imports: [RedisModule],
            useFactory: (redis: RedisService): QueueOptionsLike => ({
                connection: redis.createBullClient(),
                defaultJobOptions: {
                    attempts: 3,
                    backoff: { type: "exponential", delay: 10_000 },
                    removeOnComplete: true,
                    removeOnFail: 10,
                },
            }),
            inject: [RedisService],
        }),
    ],
    providers: [AccountDeletionService, AccountDeletionQueueProcessor],
    exports: [BullModule],
})
export class AccountDeletionModule {}
