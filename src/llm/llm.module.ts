import { HttpModule, HttpService } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GeminiFlashClient } from './gemini-flash.client';
import { LLM_SERVICE } from './llm.service';
import { MockLlmService } from './mock-llm.service';
import { SCRIPT_GENERATE_QUEUE, SUMMARY_GENERATE_QUEUE, SummaryScriptService } from './summary-script.service';
import { SummaryController } from './summary.controller';

// ワーカーをここに含めるか、別のモジュールにするか
// import { SummaryWorker } from './workers/summary.worker';
// import { ScriptWorker } from './workers/script.worker';

@Module({
    imports: [
        HttpModule,
        ConfigModule, // ConfigService を使う場合
        BullModule.registerQueue( // キューを登録
            { name: SUMMARY_GENERATE_QUEUE },
            { name: SCRIPT_GENERATE_QUEUE },
        ),
    ],
    providers: [
        {
            provide: LLM_SERVICE,
            useFactory: (configService: ConfigService, httpClient: HttpService) => { // useFactoryで依存性注入
                if (configService.get<string>('TEST_MODE') === 'true') {
                    return new MockLlmService();
                }
                return new GeminiFlashClient(httpClient); // httpClient を注入
            },
            inject: [ConfigService, HttpService], // 注入するものを指定
        },
        SummaryScriptService,
        // SummaryWorker, // ワーカーを登録
        // ScriptWorker,  // ワーカーを登録
        // もしGeminiFlashClientがConfigServiceを必要とするなら、それもuseFactoryで注入
    ],
    controllers: [SummaryController],
    exports: [LLM_SERVICE, SummaryScriptService, BullModule], // BullModuleもエクスポートすると他でキューを使える
})
export class LlmModule {}