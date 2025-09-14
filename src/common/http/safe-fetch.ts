import http, { type IncomingMessage, type RequestOptions } from "node:http";
import https from "node:https";
import { PassThrough, Readable, Transform } from "node:stream";
import { URL } from "node:url";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    parseExtraDenyCidrsFromEnv,
    resolveAndFilterUnicast,
} from "@/common/net/ip-range.util";

const logger = new Logger("SafeFetch");

export type SafeFetchErrorType =
    | "invalid_url"
    | "disallowed_scheme"
    | "disallowed_port"
    | "blocked_destination"
    | "timeout_connect"
    | "timeout_response"
    | "timeout_idle"
    | "timeout_total"
    | "redirect_error"
    | "missing_location"
    | "unsupported_media_type"
    | "payload_too_large"
    | "upstream_error";

export class SafeFetchError extends Error {
    constructor(
        public readonly type: SafeFetchErrorType,
        message?: string,
    ) {
        super(message ?? type);
        this.name = "SafeFetchError";
    }
}

function getPort(url: URL): number {
    if (url.port) return Number(url.port);
    return url.protocol === "https:" ? 443 : 80;
}

function validateSchemeAndPort(url: URL, cfg: ConfigService) {
    const allowHttp = cfg.get<boolean>("FEED_FETCH_ALLOW_HTTP", false);
    if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
        throw new SafeFetchError(
            "disallowed_scheme",
            "Only https is allowed in production",
        );
    }
    const port = getPort(url);
    // 許可ポートは 80 / 443 のみ
    if (!(port === 80 || port === 443)) {
        throw new SafeFetchError(
            "disallowed_port",
            `Port ${port} is not allowed`,
        );
    }
}

function buildHeaders(
    cfg: ConfigService,
    host: string,
): Record<string, string> {
    const ua = cfg.get<string>(
        "FEED_FETCH_USER_AGENT",
        "MyceliaRSSFetcher/1.0",
    );
    return {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": ua,
        Host: host,
    };
}

export async function safeFetchOnce(
    url: URL,
    cfg: ConfigService,
    abortSignal: AbortSignal,
    totalDeadlineMs: number,
): Promise<IncomingMessage> {
    validateSchemeAndPort(url, cfg);

    const extraCidrs = parseExtraDenyCidrsFromEnv(cfg);
    const { safeIps, allIps } = await resolveAndFilterUnicast(
        url.hostname,
        extraCidrs,
    );
    if (safeIps.length === 0) {
        logger.warn(
            `blocked destination by IP policy: host=${url.hostname} ips=${allIps.join(",")}`,
        );
        throw new SafeFetchError(
            "blocked_destination",
            "Destination blocked by IP policy",
        );
    }

    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;
    const headers = buildHeaders(cfg, url.hostname);
    const port = getPort(url);

    // タイムアウト管理
    const connectTimeoutMs = cfg.get<number>(
        "FEED_FETCH_CONNECT_TIMEOUT_MS",
        2000,
    );
    const responseTimeoutMs = cfg.get<number>(
        "FEED_FETCH_RESPONSE_TIMEOUT_MS",
        5000,
    );

    return await new Promise<IncomingMessage>((resolve, reject) => {
        const baseAgentOptions = {
            keepAlive: false,
            // Nodeのlookup置換：安全に解決したIPに固定
            lookup: (
                _hostname: string,
                _opts: unknown,
                cb: (
                    err: NodeJS.ErrnoException | null,
                    address: string,
                    family: 4 | 6,
                ) => void,
            ) => {
                const ip = safeIps[0];
                const family = (ip.includes(":") ? 6 : 4) as 4 | 6;
                cb(null, ip, family);
            },
        };

        const agent = isHttps
            ? new https.Agent(baseAgentOptions)
            : new http.Agent(baseAgentOptions);

        const options: RequestOptions = {
            protocol: url.protocol,
            host: url.hostname,
            port,
            path: `${url.pathname}${url.search}`,
            method: "GET",
            headers,
            // 直結（プロキシ未使用）
            agent,
        };

        if (isHttps) {
            // SNIは元のホスト名
            (options as https.RequestOptions).servername = url.hostname;
            (options as https.RequestOptions).rejectUnauthorized = true;
        }

        const req = transport.request(options);

        // AbortSignal
        const abortHandler = () => {
            req.destroy(
                new SafeFetchError(
                    "timeout_total",
                    "Aborted by total timeout/abort",
                ),
            );
        };
        abortSignal.addEventListener("abort", abortHandler, { once: true });

        // 合計タイムアウト（安全のため保険）
        const now = Date.now();
        const remain = Math.max(0, totalDeadlineMs - now);
        const totalTimer = setTimeout(() => {
            req.destroy(
                new SafeFetchError("timeout_total", "Total timeout reached"),
            );
        }, remain);

        // 接続タイムアウト：ソケット接続まで
        let connectTimer: NodeJS.Timeout | null = setTimeout(() => {
            req.destroy(
                new SafeFetchError("timeout_connect", "Connect timeout"),
            );
        }, connectTimeoutMs);

        req.on("socket", (socket) => {
            socket.on("connect", () => {
                if (connectTimer) {
                    clearTimeout(connectTimer);
                    connectTimer = null;
                }
            });
            socket.on("secureConnect", () => {
                if (connectTimer) {
                    clearTimeout(connectTimer);
                    connectTimer = null;
                }
            });
        });

        // 応答ヘッダタイムアウト：response イベントまで
        const responseTimer = setTimeout(() => {
            req.destroy(
                new SafeFetchError(
                    "timeout_response",
                    "Response header timeout",
                ),
            );
        }, responseTimeoutMs);

        req.on("response", (res) => {
            clearTimeout(responseTimer);
            if (connectTimer) {
                clearTimeout(connectTimer);
                connectTimer = null;
            }
            clearTimeout(totalTimer);
            abortSignal.removeEventListener("abort", abortHandler);
            resolve(res);
        });

        req.on("error", (err) => {
            clearTimeout(responseTimer);
            if (connectTimer) {
                clearTimeout(connectTimer);
                connectTimer = null;
            }
            clearTimeout(totalTimer);
            abortSignal.removeEventListener("abort", abortHandler);
            if (err instanceof SafeFetchError) return reject(err);
            reject(new SafeFetchError("upstream_error", err.message));
        });

        req.end();
    });
}

export async function safeFollowRedirects(
    initialUrl: URL,
    cfg: ConfigService,
    totalTimeoutMs: number,
): Promise<IncomingMessage> {
    const maxRedirects = cfg.get<number>("FEED_FETCH_MAX_REDIRECTS", 3);
    const allowHttp = cfg.get<boolean>("FEED_FETCH_ALLOW_HTTP", false);
    const start = Date.now();
    let url = initialUrl;
    for (let i = 0; i <= maxRedirects; i++) {
        const controller = new AbortController();
        const res = await safeFetchOnce(
            url,
            cfg,
            controller.signal,
            start + totalTimeoutMs,
        );
        const status = res.statusCode ?? 0;
        if (status >= 200 && status < 300) {
            return res; // 成功
        }
        if ([301, 302, 303, 307, 308].includes(status)) {
            const location = res.headers.location as string | undefined;
            if (!location) {
                res.destroy();
                throw new SafeFetchError(
                    "missing_location",
                    "Redirect Location header missing",
                );
            }
            const next = new URL(location, url);
            // 許可スキーム
            if (
                !(
                    next.protocol === "https:" ||
                    (allowHttp && next.protocol === "http:")
                )
            ) {
                res.destroy();
                throw new SafeFetchError(
                    "redirect_error",
                    "Disallowed redirect scheme",
                );
            }
            res.destroy(); // 前レスポンスは破棄
            url = next; // 次へ
            continue;
        }
        // その他の3xx は不正
        if (status >= 300 && status < 400) {
            res.destroy();
            throw new SafeFetchError(
                "redirect_error",
                `Unhandled redirect status: ${status}`,
            );
        }
        // 上流 4xx/5xx は 502 扱い（サービス層で変換）
        return res;
    }
    throw new SafeFetchError("redirect_error", "Too many redirects");
}

export function createByteLimitStream(
    maxBytes: number,
    onLimit: () => void,
): Transform {
    let total = 0;
    return new Transform({
        transform(chunk, _enc, cb) {
            total += chunk.length;
            if (total > maxBytes) {
                onLimit();
                cb(
                    new SafeFetchError(
                        "payload_too_large",
                        "Decompressed size exceeded",
                    ),
                );
                return;
            }
            cb(null, chunk);
        },
    });
}

export function createDecompressionStream(
    contentEncoding: string,
    contentType: string,
    onError: (e: unknown) => void,
): (src: IncomingMessage) => Readable {
    return (src: IncomingMessage): Readable => {
        const enc = contentEncoding.toLowerCase();
        if (enc === "gzip" || enc === "x-gzip") {
            const gunzip = createGunzip();
            src.on("error", onError).pipe(gunzip);
            return gunzip;
        }
        if (enc === "deflate") {
            const inflate = createInflate();
            src.on("error", onError).pipe(inflate);
            return inflate;
        }
        if (enc === "br") {
            const br = createBrotliDecompress();
            src.on("error", onError).pipe(br);
            return br;
        }
        // Content-Typeが圧縮コンテナ（application/gzip）の場合
        const ct = contentType.toLowerCase();
        if (ct.startsWith("application/gzip") || ct === "application/x-gzip") {
            const gunzip = createGunzip();
            src.on("error", onError).pipe(gunzip);
            return gunzip;
        }
        // それ以外は素通し
        const pass = new PassThrough();
        src.on("error", onError).pipe(pass);
        return pass;
    };
}
