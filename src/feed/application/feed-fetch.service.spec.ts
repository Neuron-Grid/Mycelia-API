import { gzipSync } from "node:zlib";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";
import { HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import nock from "nock";
import { FeedFetchService } from "@/feed/application/feed-fetch.service";

// Mock DNS/IP utilities to avoid real resolution
jest.mock("@/common/net/ip-range.util", () => ({
    resolveAndFilterUnicast: jest.fn(async () => ({
        safeIps: ["93.184.216.34"],
        allIps: ["93.184.216.34"],
    })),
    parseExtraDenyCidrsFromEnv: jest.fn(() => []),
}));

function createConfig(values: Record<string, unknown> = {}): ConfigService {
    return new ConfigService({
        FEED_FETCH_ALLOW_HTTP: false,
        FEED_FETCH_MAX_REDIRECTS: 3,
        FEED_FETCH_CONNECT_TIMEOUT_MS: 200,
        FEED_FETCH_RESPONSE_TIMEOUT_MS: 200,
        FEED_FETCH_BODY_IDLE_TIMEOUT_MS: 200,
        FEED_FETCH_TOTAL_TIMEOUT_MS: 2000,
        FEED_FETCH_MAX_BYTES: 1024 * 5,
        FEED_FETCH_USER_AGENT: "MyceliaRSSFetcher/1.0",
        ...values,
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

    async function build(values: Record<string, unknown> = {}) {
        const moduleRef = await Test.createTestingModule({
            providers: [
                FeedFetchService,
                { provide: ConfigService, useValue: createConfig(values) },
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
        const svc = await build({ FEED_FETCH_ALLOW_HTTP: false });
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
        const svc = await build({ FEED_FETCH_MAX_BYTES: 100 });
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
            FEED_FETCH_RESPONSE_TIMEOUT_MS: 50,
            FEED_FETCH_TOTAL_TIMEOUT_MS: 500,
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
            FEED_FETCH_CONNECT_TIMEOUT_MS: 50,
            FEED_FETCH_TOTAL_TIMEOUT_MS: 500,
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
            FEED_FETCH_BODY_IDLE_TIMEOUT_MS: 50,
            FEED_FETCH_TOTAL_TIMEOUT_MS: 1000,
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
