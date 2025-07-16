export interface PaginatedResult<T> {
    data: T[];
    // 全件数
    total: number;
    // 現在ページ (1-origin)
    page: number;
    // 1ページあたり件数
    limit: number;
    // 次ページが存在するか
    hasNext: boolean;
}
