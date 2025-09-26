import { createHash } from "node:crypto";

/**
 * canonical_urlが存在すれば優先し、なければlinkを用いてハッシュ化対象を正規化する。
 * トリガー仕様に合わせて trim → lower を適用する。
 */
export function normalizeForHash(
    canonicalUrl?: string | null,
    link?: string | null,
): string {
    return (canonicalUrl ?? link ?? "").trim().toLowerCase();
}

/**
 * UTF-8エンコードした正規化文字列に対して SHA-256 を適用し、hex文字列を返す。
 */
export function computeExpectedHash(
    canonicalUrl?: string | null,
    link?: string | null,
): string {
    const normalized = normalizeForHash(canonicalUrl, link);
    return createHash("sha256")
        .update(Buffer.from(normalized, "utf8"))
        .digest("hex");
}

/**
 * link_hash列が64桁のhex文字列かどうかを判定するユーティリティ。
 */
export function isValidLinkHash(value: unknown): value is string {
    return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
