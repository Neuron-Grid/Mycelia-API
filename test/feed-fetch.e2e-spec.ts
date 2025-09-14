import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import nock from "nock";
import { gzipSync } from "node:zlib";

// BullMQスタブ（既存E2Eと同様）
jest.mock("@nestjs/bullmq", () => {
    class BullMqStubModule {}
    class WorkerHost {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: stub
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

// DNSユーティリティをモック
jest.mock("@/common/net/ip-range.util", () => ({
    resolveAndFilterUnicast: jest.fn(async () => ({ safeIps: ["93.184.216.34"], allIps: ["93.184.216.34"] })),
    parseExtraDenyCidrsFromEnv: jest.fn(() => []),
}));

import { FeedFetchService } from "@/feed/application/feed-fetch.service";

describe("FeedFetchService (e2e)", () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            providers: [
                FeedFetchService,
                {
                    provide: ConfigService,
                    useValue: new ConfigService({
                        FEED_FETCH_ALLOW_HTTP: false,
                        FEED_FETCH_MAX_REDIRECTS: 3,
                        FEED_FETCH_CONNECT_TIMEOUT_MS: 500,
                        FEED_FETCH_RESPONSE_TIMEOUT_MS: 1000,
                        FEED_FETCH_BODY_IDLE_TIMEOUT_MS: 1000,
                        FEED_FETCH_TOTAL_TIMEOUT_MS: 5000,
                        FEED_FETCH_MAX_BYTES: 1024 * 5,
                        FEED_FETCH_USER_AGENT: "MyceliaRSSFetcher/1.0",
                    }),
                },
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
        nock("https://example.com")
            .get("/rss.gz")
            .reply(200, gz, { "Content-Type": "application/rss+xml", "Content-Encoding": "gzip" });

        const res = await feed.parseFeed("https://example.com/rss.gz");
        expect(res.meta.title).toContain("E2E");
        expect(res.items.length).toBe(1);
    });
});
