/**
 * 共通APIレスポンス整形ユーティリティ
 * @param message メッセージ
 * @param data データ
 * @returns { message: string, data?: T }
 */
export function buildResponse<T>(message: string, data?: T) {
    return data !== undefined ? { message, data } : { message }
}
