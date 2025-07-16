// @file 共通APIレスポンス整形ユーティリティ
// @public
// @since 1.0.0
// @template T
// @param {string} message - メッセージ
// @param {T} data - データ
// @returns {{ message: string, data: T }} - レスポンスオブジェクト
// @example
// const res = buildResponse('OK', { id: 1 })
// @see https://www.typescriptlang.org/docs/handbook/2/generics.html
export function buildResponse<T>(message: string, data: T) {
    return { message, data };
}
