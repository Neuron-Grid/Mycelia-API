import type { QueueOptionsLike } from "@nestjs/bullmq";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AccountDeletionQueueProcessor } from "@/account-deletion/account-deletion.processor";
import { AccountDeletionService } from "@/account-deletion/account-deletion.service";
import { AuthModule } from "@/auth/auth.module";
import { DistributedLockModule } from "@/shared/lock/distributed-lock.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { RedisService } from "@/shared/redis/redis.service";

// オプション機能の条件付きロード
const optionalImports: Array<import("@nestjs/common").Type> = [];
const optionalProviders: import("@nestjs/common").Provider[] = [];
if (process.env.ENABLE_OPTIONAL_MODULES !== "false") {
    /* eslint-disable @typescript-eslint/no-require-imports */
    optionalImports.push(
        require("@/podcast/core/podcast-core.module").PodcastCoreModule,
    );
    // CloudflareR2Service は PodcastCoreModule からクラストークンで export される
    // AccountDeletionService は文字列トークンで @Inject するため alias を登録
    const R2Class =
        require("@/podcast/cloudflare-r2.service").CloudflareR2Service;
    optionalProviders.push({
        provide: "CloudflareR2Service",
        useExisting: R2Class,
    });
}

@Module({
    imports: [
        RedisModule,
        AuthModule,
        DistributedLockModule,
        ...optionalImports,
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
    providers: [
        AccountDeletionService,
        AccountDeletionQueueProcessor,
        ...optionalProviders,
    ],
    exports: [BullModule],
})
export class AccountDeletionModule {}
