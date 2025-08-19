import { HttpModule, HttpService } from "@nestjs/axios";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EmbeddingModule } from "@/embedding/embedding.module";
import { DistributedLockModule } from "@/shared/lock/distributed-lock.module";
import { RedisModule } from "@/shared/redis/redis.module";
import { RedisService } from "@/shared/redis/redis.service";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { SummaryController } from "./application/controllers/summary.controller";
import { LLM_SERVICE } from "./application/services/llm.service";
import {
    SCRIPT_GENERATE_QUEUE,
    SUMMARY_GENERATE_QUEUE,
    SummaryScriptService,
} from "./application/services/summary-script.service";
import { GeminiFlashClient } from "./infrastructure/clients/gemini-flash.client";
import { MockLlmService } from "./infrastructure/clients/mock-llm.service";
import { DailySummaryRepository } from "./infrastructure/repositories/daily-summary.repository";
import { WorkerDailySummaryRepository } from "./infrastructure/repositories/worker-daily-summary.repository";
import { ScriptWorker } from "./infrastructure/workers/script.worker";
import { SummaryWorker } from "./infrastructure/workers/summary.worker";

@Module({
    imports: [
        HttpModule,
        ConfigModule, // ConfigService を使う場合
        RedisModule,
        DistributedLockModule,
        BullModule.registerQueueAsync(
            {
                name: SUMMARY_GENERATE_QUEUE,
                imports: [RedisModule],
                useFactory: (redis: RedisService) => ({
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
                useFactory: (redis: RedisService) => ({
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
        EmbeddingModule, // EmbeddingQueueService を利用
    ],
    providers: [
        DailySummaryRepository,
        WorkerDailySummaryRepository,
        SupabaseAdminService,
        UserSettingsRepository,
        {
            provide: LLM_SERVICE,
            useFactory: (
                configService: ConfigService,
                httpClient: HttpService,
            ) => {
                // useFactoryで依存性注入
                if (configService.get<string>("TEST_MODE") === "true") {
                    return new MockLlmService();
                }
                return new GeminiFlashClient(httpClient, configService); // httpClient と configService を注入
            },
            inject: [ConfigService, HttpService], // 注入するものを指定
        },
        SummaryScriptService,
        SummaryWorker, // ワーカーを登録
        ScriptWorker, // ワーカーを登録
        // もしGeminiFlashClientがConfigServiceを必要とするなら、それもuseFactoryで注入
    ],
    controllers: [SummaryController],
    exports: [
        LLM_SERVICE,
        SummaryScriptService,
        BullModule,
        // Queue/Core側で DailySummaryRepository を注入できるように公開
        DailySummaryRepository,
    ], // BullModuleもエクスポートすると他でキューを使える
})
export class LlmModule {}
