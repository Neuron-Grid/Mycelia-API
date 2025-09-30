/**
 * 公開日時が存在しない場合に created_at をフォールバックとして利用し、ISO8601文字列で返却する。
 * @param publishedAt - フィードアイテムの公開日時
 * @param createdAt - フィードアイテムの作成日時（必須）
 */
export function resolveFeedItemPublishedAt(
    publishedAt: string | Date | null | undefined,
    createdAt: string | Date,
): string {
    if (publishedAt) {
        return normalizeToIsoString(publishedAt);
    }
    return normalizeToIsoString(createdAt);
}

function normalizeToIsoString(value: string | Date): string {
    if (value instanceof Date) {
        return value.toISOString();
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date value supplied: ${value}`);
    }
    return date.toISOString();
}
