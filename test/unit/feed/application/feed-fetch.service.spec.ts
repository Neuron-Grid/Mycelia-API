import { gzipSync } from "node:zlib";
import { HttpException, HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import nock from "nock";
import {
    APP_ENV_TOKEN,
    type AppEnv,
    type FeedFetchConfig,
} from "@/config/app-env";
import { FeedFetchService } from "@/feed/application/feed-fetch.service";
import { createAppEnvStub } from "@test-utils/app-env";

// Mock DNS/IP utilities to avoid real resolution
jest.mock("@/common/net/ip-range.util", () => ({
    resolveAndFilterUnicast: jest.fn(async () => ({
        safeIps: ["93.184.216.34"],
        allIps: ["93.184.216.34"],
    })),
    parseExtraDenyCidrs: jest.fn(() => []),
}));

const baseConfig: FeedFetchConfig = {
    allowHttp: false,
    maxRedirects: 3,
    connectTimeoutMs: 200,
    responseTimeoutMs: 200,
    bodyIdleTimeoutMs: 200,
    totalTimeoutMs: 2000,
    maxBytes: 1024 * 5,
    userAgent: "MyceliaRSSFetcher/1.0",
    extraDenyCidrsRaw: "",
};

function createAppEnv(config: FeedFetchConfig): AppEnv {
    return createAppEnvStub({
        getFeedFetchConfig: jest.fn(() => config),
    });
}

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example</title>
    <item><title>Item1</title><link>https://example.com/1</link></item>
  </channel>
</rss>`;

describe("FeedFetchService", () => {
    beforeEach(() => nock.cleanAll());
    afterEach(() => {
        expect(nock.isDone()).toBe(true);
        nock.cleanAll();
    });

    async function build(overrides: Partial<FeedFetchConfig> = {}) {
        const config: FeedFetchConfig = {
            ...baseConfig,
            ...overrides,
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                FeedFetchService,
                { provide: APP_ENV_TOKEN, useValue: createAppEnv(config) },
            ],
        }).compile();
        return moduleRef.get(FeedFetchService);
    }

    it("parses simple RSS (200, xml)", async () => {
        const svc = await build();
        nock("https://example.com").get("/rss.xml").reply(200, sampleXml, {
            "Content-Type": "application/rss+xml; charset=utf-8",
        });
        const res = await svc.parseFeed("https://example.com/rss.xml");
        expect(res.meta.title).toContain("Example");
        expect(res.items.length).toBe(1);
    });

    it("follows redirect (<=3)", async () => {
        const svc = await build();
        nock("https://example.com")
            .get("/a")
            .reply(302, undefined, { Location: "/b" });
        nock("https://example.com").get("/b").reply(200, sampleXml, {
            "Content-Type": "application/rss+xml",
        });
        const res = await svc.parseFeed("https://example.com/a");
        expect(res.items.length).toBe(1);
    });

    it("rejects http when not allowed", async () => {
        const svc = await build({ allowHttp: false });
        await expect(
            svc.parseFeed("http://example.com/rss.xml"),
        ).rejects.toBeInstanceOf(HttpException);
        await expect(
            svc.parseFeed("http://example.com/rss.xml"),
        ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it("rejects invalid URL with 400", async () => {
        const svc = await build();
        await expect(svc.parseFeed("not a url")).rejects.toMatchObject({
            status: HttpStatus.BAD_REQUEST,
        });
    });

    it("rejects disallowed port", async () => {
        const svc = await build();
        await expect(
            svc.parseFeed("https://example.com:8443/rss.xml"),
        ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it("rejects unsupported content-type", async () => {
        const svc = await build();
        nock("https://example.com").get("/rss").reply(200, "<html></html>", {
            "Content-Type": "text/html",
        });
        await expect(
            svc.parseFeed("https://example.com/rss"),
        ).rejects.toMatchObject({ status: HttpStatus.UNSUPPORTED_MEDIA_TYPE });
    });

    it("decompresses gzip", async () => {
        const svc = await build();
        const gz = gzipSync(Buffer.from(sampleXml));
        nock("https://example.com").get("/gz").reply(200, gz, {
            "Content-Type": "application/rss+xml",
            "Content-Encoding": "gzip",
        });
        const res = await svc.parseFeed("https://example.com/gz");
        expect(res.items.length).toBe(1);
    });

    it("enforces size limit (413)", async () => {
        const svc = await build({ maxBytes: 100 });
        const big = `<rss>${"a".repeat(5000)}</rss>`;
        nock("https://example.com").get("/big").reply(200, big, {
            "Content-Type": "application/rss+xml",
        });
        await expect(
            svc.parseFeed("https://example.com/big"),
        ).rejects.toMatchObject({ status: HttpStatus.PAYLOAD_TOO_LARGE });
    });

    it("times out on response header (504)", async () => {
        const svc = await build({
            responseTimeoutMs: 50,
            totalTimeoutMs: 500,
        });
        nock("https://example.com")
            .get("/slow-header")
            .delay(100)
            .reply(200, sampleXml, {
                "Content-Type": "application/rss+xml",
            });
        await expect(
            svc.parseFeed("https://example.com/slow-header"),
        ).rejects.toMatchObject({ status: HttpStatus.GATEWAY_TIMEOUT });
    });

    it("times out on connect (504)", async () => {
        const svc = await build({
            connectTimeoutMs: 50,
            totalTimeoutMs: 500,
        });
        nock("https://example.com")
            .get("/slow-connect")
            .delayConnection(200)
            .reply(200, sampleXml, {
                "Content-Type": "application/rss+xml",
            });
        await expect(
            svc.parseFeed("https://example.com/slow-connect"),
        ).rejects.toMatchObject({ status: HttpStatus.GATEWAY_TIMEOUT });
    });

    it("times out on body idle (504)", async () => {
        const svc = await build({
            bodyIdleTimeoutMs: 50,
            totalTimeoutMs: 1000,
        });
        nock("https://example.com")
            .get("/idle")
            .delayBody(200)
            .reply(200, sampleXml, {
                "Content-Type": "application/rss+xml",
            });
        await expect(
            svc.parseFeed("https://example.com/idle"),
        ).rejects.toMatchObject({ status: HttpStatus.GATEWAY_TIMEOUT });
    });

    it("maps upstream 404 to 502", async () => {
        const svc = await build();
        nock("https://example.com").get("/404").reply(404, "not found");
        await expect(
            svc.parseFeed("https://example.com/404"),
        ).rejects.toMatchObject({ status: HttpStatus.BAD_GATEWAY });
    });

    it("application/gzip with non-xml becomes 415", async () => {
        const svc = await build();
        const gz = gzipSync(Buffer.from("not-xml"));
        nock("https://example.com").get("/gzbin").reply(200, gz, {
            "Content-Type": "application/gzip",
        });
        await expect(
            svc.parseFeed("https://example.com/gzbin"),
        ).rejects.toMatchObject({ status: HttpStatus.UNSUPPORTED_MEDIA_TYPE });
    });
});
