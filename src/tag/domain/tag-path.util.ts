/**
 * ltree 形式のパス文字列をアプリ層の string[] へ正規化する。
 */
export function normalizeTagPath(
    raw: string | string[] | null | undefined,
): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.filter(
            (segment): segment is string => !!segment && segment.length > 0,
        );
    }

    return raw
        .split(".")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
}
