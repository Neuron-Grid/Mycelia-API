import { gzipSync } from "node:zlib";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { jest } from "@test-utils/jest-globals";
import nock from "nock";

// BullMQスタブ（既存E2Eと同様）
jest.mock("@nestjs/bullmq", () => {
    class BullMqStubModule {}
    class WorkerHost {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: モック用の空実装
        process() {}
    }

    const createDynamicModule = () => ({
        module: BullMqStubModule,
        providers: [],
        exports: [],
    });

    return {
        BullModule: {
            registerQueueAsync: () => createDynamicModule(),
            registerQueue: () => createDynamicModule(),
            forRootAsync: () => createDynamicModule(),
        },
        InjectQueue: () => () => undefined,
        Processor: () => (cls: unknown) => cls,
        WorkerHost,
    };
});

// Podcast/TTS系はNode ESM依存がありE2Eでは未使用のためスタブ
jest.mock("@/podcast/podcast.module", () => ({ PodcastModule: class {} }));
jest.mock("@/podcast/queue/podcast-queue.module", () => ({
    PodcastQueueModule: class {},
}));
jest.mock("@/podcast/core/podcast-core.module", () => ({
    PodcastCoreModule: class {},
}));
jest.mock("@/podcast/podcast-tts.service", () => ({
    PodcastTtsService: class {},
}));
jest.mock(
    "uuid",
    () => ({ v4: () => "00000000-0000-0000-0000-000000000000" }),
    { virtual: true },
);
jest.mock("@/embedding/queue/embedding-queue.module", () => ({
    EmbeddingQueueModule: class {},
}));
jest.mock("@/feed/queue/feed-queue.module", () => ({
    FeedQueueModule: class {},
}));
jest.mock("@/maintenance/maintenance-queue.module", () => ({
    MaintenanceQueueModule: class {},
}));
jest.mock("@/llm/llm.module", () => ({ LlmModule: class {} }));

// DNSユーティリティをモック
jest.mock("@/common/net/ip-range.util", () => ({
    resolveAndFilterUnicast: jest.fn(async () => ({
        safeIps: ["93.184.216.34"],
        allIps: ["93.184.216.34"],
    })),
    parseExtraDenyCidrs: jest.fn(() => []),
}));

import { APP_ENV_TOKEN, type FeedFetchConfig } from "@/config/app-env";
import { FeedFetchService } from "@/feed/application/feed-fetch.service";
import { createAppEnvStub } from "./utils/app-env";

describe("FeedFetchService (e2e)", () => {
    let app: INestApplication;
    const feedFetchConfig: FeedFetchConfig = {
        allowHttp: false,
        maxRedirects: 3,
        connectTimeoutMs: 500,
        responseTimeoutMs: 1000,
        bodyIdleTimeoutMs: 1000,
        totalTimeoutMs: 5000,
        maxBytes: 1024 * 5,
        userAgent: "MyceliaRSSFetcher/1.0",
        extraDenyCidrsRaw: "",
    };

    const appEnv = createAppEnvStub({
        getFeedFetchConfig: jest.fn(() => feedFetchConfig),
    });

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            providers: [
                FeedFetchService,
                { provide: APP_ENV_TOKEN, useValue: appEnv },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app?.close();
    });

    beforeEach(() => nock.cleanAll());
    afterEach(() => {
        expect(nock.isDone()).toBe(true);
        nock.cleanAll();
    });

    it("fetches and parses gzip RSS end-to-end", async () => {
        const feed = app.get(FeedFetchService);
        const xml = `<?xml version="1.0"?><rss><channel><title>E2E</title><item><title>X</title></item></channel></rss>`;
        const gz = gzipSync(Buffer.from(xml));
        nock("https://example.com").get("/rss.gz").reply(200, gz, {
            "Content-Type": "application/rss+xml",
            "Content-Encoding": "gzip",
        });

        const res = await feed.parseFeed("https://example.com/rss.gz");
        expect(res.meta.title).toContain("E2E");
        expect(res.items.length).toBe(1);
    });
});
