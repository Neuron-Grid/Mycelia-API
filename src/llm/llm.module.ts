import { HttpModule, HttpService } from "@nestjs/axios";
import type { QueueOptionsLike } from "@nestjs/bullmq";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { APP_ENV_TOKEN, type AppEnv } from "@/config/app-env";
import { IS_WORKER_APP } from "@/config/runtime.constants";
import { EmbeddingModule } from "@/embedding/embedding.module";
import { DistributedLockModule } from "@/shared/lock/distributed-lock.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { RedisService } from "@/shared/redis/redis.service";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { SummaryController } from "./application/controllers/summary.controller";
import { LLM_SERVICE } from "./application/services/llm.service";
import {
    SCRIPT_GENERATE_QUEUE,
    SUMMARY_GENERATE_QUEUE,
    SummaryScriptService,
} from "./application/services/summary-script.service";
import { GeminiFlashClient } from "./infrastructure/clients/gemini-flash.client";
import { DailySummaryRepository } from "./infrastructure/repositories/daily-summary.repository";
import { WorkerDailySummaryRepository } from "./infrastructure/repositories/worker-daily-summary.repository";
import { ScriptWorker } from "./infrastructure/workers/script.worker";
import { SummaryWorker } from "./infrastructure/workers/summary.worker";

const workerImports = IS_WORKER_APP ? [DistributedLockModule] : [];
const workerProviders = IS_WORKER_APP
    ? [WorkerDailySummaryRepository, SummaryWorker, ScriptWorker]
    : [];
const controllers = IS_WORKER_APP ? [] : [SummaryController];

@Module({
    imports: [
        HttpModule,
        RedisModule,
        BullModule.registerQueueAsync(
            {
                name: SUMMARY_GENERATE_QUEUE,
                imports: [RedisModule],
                useFactory: (redis: RedisService): QueueOptionsLike => ({
                    connection: redis.createBullClient(),
                    limiter: {
                        max: 50,
                        duration: 1000,
                        groupKey: "data.userId",
                    },
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: { type: "fixed", delay: 30_000 },
                        removeOnComplete: 5,
                        removeOnFail: 10,
                    },
                }),
                inject: [RedisService],
            },
            {
                name: SCRIPT_GENERATE_QUEUE,
                imports: [RedisModule],
                useFactory: (redis: RedisService): QueueOptionsLike => ({
                    connection: redis.createBullClient(),
                    limiter: {
                        max: 50,
                        duration: 1000,
                        groupKey: "data.userId",
                    },
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: { type: "fixed", delay: 30_000 },
                        removeOnComplete: 5,
                        removeOnFail: 10,
                    },
                }),
                inject: [RedisService],
            },
        ),
        SupabaseRequestModule, // SupabaseAuthGuard の依存関係を解決
        AuthModule,
        EmbeddingModule, // EmbeddingQueueService を利用
        ...workerImports,
    ],
    providers: [
        DailySummaryRepository,
        UserSettingsRepository,
        {
            provide: LLM_SERVICE,
            useFactory: (httpClient: HttpService, appEnv: AppEnv) => {
                return new GeminiFlashClient(httpClient, appEnv);
            },
            inject: [HttpService, APP_ENV_TOKEN],
        },
        SummaryScriptService,
        ...workerProviders,
    ],
    controllers,
    exports: [
        LLM_SERVICE,
        SummaryScriptService,
        BullModule,
        // Queue/Core側で DailySummaryRepository を注入できるように公開
        DailySummaryRepository,
    ], // BullModuleもエクスポートすると他でキューを使える
})
export class LlmModule {}
