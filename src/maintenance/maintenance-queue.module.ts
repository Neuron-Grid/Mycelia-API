import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { RedisModule } from "src/shared/redis/redis.module";
import { RedisService } from "src/shared/redis/redis.service";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { MaintenanceService } from "./maintenance.service";
import { MaintenanceQueueProcessor } from "./maintenance-queue.processor";

@Module({
    imports: [
        SupabaseRequestModule,
        RedisModule,
        BullModule.registerQueueAsync({
            name: "maintenanceQueue",
            imports: [RedisModule],
            useFactory: (redis: RedisService) => ({
                connection: redis.createBullClient(),
                defaultJobOptions: {
                    attempts: 2,
                    backoff: { type: "fixed", delay: 30_000 },
                    removeOnComplete: 5,
                    removeOnFail: 5,
                },
            }),
            inject: [RedisService],
        }),
    ],
    providers: [MaintenanceService, MaintenanceQueueProcessor],
    exports: [BullModule],
})
export class MaintenanceQueueModule {}
