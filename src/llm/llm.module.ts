import { HttpModule, HttpService } from "@nestjs/axios";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SupabaseRequestModule } from "src/supabase-request.module";
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
import { ScriptWorker } from "./infrastructure/workers/script.worker";
import { SummaryWorker } from "./infrastructure/workers/summary.worker";

@Module({
    imports: [
        HttpModule,
        ConfigModule, // ConfigService を使う場合
        BullModule.registerQueue(
            // キューを登録
            {
                name: SUMMARY_GENERATE_QUEUE,
                // Redis 接続設定を追加
                connection: {
                    host: process.env.REDIS_HOST || "localhost",
                    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
                },
            },
            {
                name: SCRIPT_GENERATE_QUEUE,
                // Redis 接続設定を追加
                connection: {
                    host: process.env.REDIS_HOST || "localhost",
                    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
                },
            },
        ),
        SupabaseRequestModule, // SupabaseAuthGuard の依存関係を解決
    ],
    providers: [
        DailySummaryRepository,
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
    exports: [LLM_SERVICE, SummaryScriptService, BullModule], // BullModuleもエクスポートすると他でキューを使える
})
export class LlmModule {}
