/** Redis DTOs */

// Redisの設定情報を扱うためのDTO
export class RedisConfigDto {
    /** Redisホスト名（またはIPアドレス） */
    host: string;

    /** Redisのポート番号 */
    port: number;

    /** Redisのパスワード（ない場合は空） */
    password?: string;
}

// RedisへのPING結果など、ヘルスチェック情報を扱うためのDTO
export class RedisHealthDto {
    /** Redis接続ステータス（OK / NGなど） */
    status: string;

    /** PINGコマンドの結果 */
    pingResult?: string;

    /** Redis接続が失敗した場合などのエラー内容 */
    errorMessage?: string;
}
