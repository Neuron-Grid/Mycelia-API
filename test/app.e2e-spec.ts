/**
 * E2E専用テスト: 本番コードからTEST_MODE分岐を排除し、
 * LLMのモックはテスト側で`overrideProvider`により差し替える。
 */

import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

// BullMQはE2Eでは外部接続を行わないようスタブ化
jest.mock("@nestjs/bullmq", () => {
    class BullMqStubModule {}
    class WorkerHost {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        // biome-ignore lint/suspicious/noEmptyBlockStatements: stub only
        process() {}
    }
    return {
        BullModule: class {
            static registerQueueAsync() {
                return { module: BullMqStubModule, providers: [], exports: [] };
            }
            static registerQueue() {
                return { module: BullMqStubModule, providers: [], exports: [] };
            }
            static forRootAsync() {
                return { module: BullMqStubModule, providers: [], exports: [] };
            }
        },
        InjectQueue: () => () => undefined,
        Processor: () => (cls: unknown) => cls,
        WorkerHost,
    };
});

// Podcast/TTS系はNode ESM依存がありE2Eでは未使用のためスタブ
jest.mock("@/podcast/podcast.module", () => ({ PodcastModule: class {} }));
jest.mock("@/podcast/queue/podcast-queue.module", () => ({ PodcastQueueModule: class {} }));
jest.mock("@/podcast/core/podcast-core.module", () => ({ PodcastCoreModule: class {} }));
jest.mock("@/podcast/podcast-tts.service", () => ({ PodcastTtsService: class {} }));
jest.mock("uuid", () => ({ v4: () => "00000000-0000-0000-0000-000000000000" }), { virtual: true });
jest.mock("@/embedding/queue/embedding-queue.module", () => ({ EmbeddingQueueModule: class {} }));
jest.mock("@/feed/queue/feed-queue.module", () => ({ FeedQueueModule: class {} }));
jest.mock("@/maintenance/maintenance-queue.module", () => ({ MaintenanceQueueModule: class {} }));
jest.mock("@/llm/llm.module", () => ({ LlmModule: class {} }));

import { AppModule } from "@/app.module";
import {
    LLM_SERVICE,
    type LlmService,
} from "@/llm/application/services/llm.service";
import { MockLlmService } from "@/llm/infrastructure/clients/mock-llm.service";

describe("LLM mock override (e2e)", () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(LLM_SERVICE)
            .useClass(MockLlmService)
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app?.close();
    });

    it("LLM_SERVICEがモックに差し替わっている", async () => {
        const svc = app.get<LlmService>(LLM_SERVICE);
        expect(svc).toBeInstanceOf(MockLlmService);
    });
});
