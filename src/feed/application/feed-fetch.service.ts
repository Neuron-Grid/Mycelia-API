// @file RSSフィードの取得とパースを行うサービス（安全な取得・検証・制限を実装）

import type { IncomingMessage } from "node:http";
import { Readable, Transform } from "node:stream";
import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// @see https://www.npmjs.com/package/feedparser
import FeedParser, { Item as FeedparserItem, Meta } from "feedparser";
import {
    createByteLimitStream,
    createDecompressionStream,
    SafeFetchError,
    safeFollowRedirects,
} from "@/common/http/safe-fetch";

@Injectable()
// @public
// @since 1.0.0
export class FeedFetchService {
    private readonly logger = new Logger(FeedFetchService.name);

    constructor(private readonly cfg: ConfigService) {}
    // @async
    // @public
    // @since 1.0.0
    // @param {string} feedUrl - RSSフィードのURL
    // @returns {Promise<{ meta: Meta; items: FeedparserItem[] }>} - パース結果（メタ情報とアイテム配列）
    // @throws {Error} - フィード取得やパースに失敗した場合
    // @example
    // const { meta, items } = await feedFetchService.parseFeed('https://example.com/rss')
    // @see FeedParser
    parseFeed(
        feedUrl: string,
    ): Promise<{ meta: Meta; items: FeedparserItem[] }> {
        const feedparser = new FeedParser({ normalize: true });
        const items: FeedparserItem[] = [];
        let meta: Meta = {} as Meta;

        const hostForLog = (() => {
            try {
                return new URL(feedUrl).hostname;
            } catch {
                return "-";
            }
        })();

        return new Promise((resolve, reject) => {
            const onError = (err: unknown) => {
                // 仕様準拠のHttpExceptionへ変換
                const httpErr = this.mapError(err);
                const reason = httpErr.message ?? "error";
                this.logger.warn(
                    `feed-fetch blocked or failed: host=${hostForLog} reason=${reason}`,
                );
                reject(httpErr);
            };

            // 本文無通信間隔監視タイマー
            const bodyIdleTimeoutMs = this.cfg.get<number>(
                "FEED_FETCH_BODY_IDLE_TIMEOUT_MS",
                5000,
            );
            let idleTimer: NodeJS.Timeout | null = null;
            const resetIdleTimer = () => {
                if (idleTimer) clearTimeout(idleTimer);
                idleTimer = setTimeout(() => {
                    onError(
                        new SafeFetchError(
                            "timeout_idle",
                            "Upstream body idle timeout",
                        ),
                    );
                }, bodyIdleTimeoutMs);
            };

            (async () => {
                try {
                    // URL 構文エラーを事前に 400(Bad Request) へマッピング
                    let parsedUrl: URL;
                    try {
                        parsedUrl = new URL(feedUrl);
                    } catch {
                        onError(
                            new SafeFetchError("invalid_url", "Invalid URL"),
                        );
                        return;
                    }
                    const totalTimeoutMs = this.cfg.get<number>(
                        "FEED_FETCH_TOTAL_TIMEOUT_MS",
                        10000,
                    );
                    const response = await safeFollowRedirects(
                        parsedUrl,
                        this.cfg,
                        totalTimeoutMs,
                    );

                    // 上流エラーを502へ
                    if (response.statusCode && response.statusCode >= 400) {
                        onError(
                            new SafeFetchError(
                                "upstream_error",
                                `Upstream error: ${response.statusCode}`,
                            ),
                        );
                        return;
                    }

                    const res: IncomingMessage = response;

                    // Content-Type 判定（圧縮ファイルは例外的に後段で再チェック）
                    const contentType =
                        (
                            res.headers["content-type"] as string | undefined
                        )?.toLowerCase() ?? "";
                    const allowedTypes = [
                        "application/rss+xml",
                        "application/atom+xml",
                        "application/xml",
                        "text/xml",
                    ];
                    const isCompressedContainer =
                        contentType.startsWith("application/gzip") ||
                        contentType === "application/x-gzip";
                    if (!isCompressedContainer) {
                        const isAllowed = allowedTypes.some((t) =>
                            contentType.startsWith(t),
                        );
                        if (!isAllowed) {
                            onError(
                                new SafeFetchError(
                                    "unsupported_media_type",
                                    `Unsupported content-type: ${contentType}`,
                                ),
                            );
                            return;
                        }
                    }

                    // 解凍 → バイト制限 → FeedParser
                    const encoding =
                        (
                            res.headers["content-encoding"] as
                                | string
                                | undefined
                        )?.toLowerCase() ?? "";
                    const maxBytes = this.cfg.get<number>(
                        "FEED_FETCH_MAX_BYTES",
                        5_242_880,
                    );

                    const decompressed: Readable = createDecompressionStream(
                        encoding,
                        contentType,
                        onError,
                    )(res);
                    const limited: Transform = createByteLimitStream(
                        maxBytes,
                        () => {
                            // onLimit: error will be emitted by the Transform
                        },
                    );

                    // XML簡易スニッファ（application/gzip 等で必用）
                    let xmlSniffed = !isCompressedContainer; // 圧縮コンテナの場合のみ後段で判定
                    const sniffTransform = new Transform({
                        transform(chunk, _enc, cb) {
                            if (!xmlSniffed) {
                                const s = chunk.toString("utf8");
                                // 先頭数KB想定：XML宣言 or ルートタグ
                                if (/^\s*<\?xml|^\s*<(rss|feed)\b/i.test(s))
                                    xmlSniffed = true;
                            }
                            cb(null, chunk);
                        },
                    });

                    // Idle監視開始
                    resetIdleTimer();
                    decompressed
                        .on("data", () => resetIdleTimer())
                        .on("error", onError)
                        .pipe(sniffTransform)
                        .on("error", onError)
                        .pipe(limited)
                        .on("error", onError)
                        .pipe(feedparser);

                    feedparser.on("error", (error: Error) => {
                        if (!xmlSniffed) {
                            onError(
                                new SafeFetchError(
                                    "unsupported_media_type",
                                    "Decompressed content is not XML",
                                ),
                            );
                            return;
                        }
                        onError(error);
                    });

                    feedparser.on("meta", function (this: FeedParser) {
                        meta = this.meta as unknown as Meta;
                    });

                    feedparser.on("readable", function (this: FeedParser) {
                        let item: FeedparserItem | null;
                        while (true) {
                            item = this.read();
                            if (!item) break;
                            items.push(item);
                        }
                    });

                    feedparser.on("end", () => {
                        if (idleTimer) clearTimeout(idleTimer);
                        if (!xmlSniffed) {
                            onError(
                                new SafeFetchError(
                                    "unsupported_media_type",
                                    "Decompressed content is not XML",
                                ),
                            );
                            return;
                        }
                        resolve({ meta, items });
                    });
                } catch (err) {
                    onError(err);
                }
            })();
        });
    }

    private mapError(err: unknown): HttpException {
        if (err instanceof HttpException) return err;
        if (err instanceof SafeFetchError) {
            switch (err.type) {
                case "invalid_url":
                case "disallowed_scheme":
                case "disallowed_port":
                    return new HttpException(
                        "Invalid or disallowed URL scheme/port",
                        HttpStatus.BAD_REQUEST,
                    );
                case "blocked_destination":
                    return new HttpException(
                        "Blocked destination",
                        HttpStatus.FORBIDDEN,
                    );
                case "timeout_connect":
                case "timeout_response":
                case "timeout_idle":
                case "timeout_total":
                    return new HttpException(
                        "Upstream fetch timeout",
                        HttpStatus.GATEWAY_TIMEOUT,
                    );
                case "payload_too_large":
                    return new HttpException(
                        "Upstream content too large",
                        HttpStatus.PAYLOAD_TOO_LARGE,
                    );
                case "redirect_error":
                case "missing_location":
                    return new HttpException(
                        "Too many redirects / Missing redirect location",
                        HttpStatus.BAD_GATEWAY,
                    );
                case "unsupported_media_type":
                    return new HttpException(
                        "Unsupported content-type",
                        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    );
                default:
                    return new HttpException(
                        "Upstream error",
                        HttpStatus.BAD_GATEWAY,
                    );
            }
        }
        return new HttpException("Upstream error", HttpStatus.BAD_GATEWAY);
    }
}
