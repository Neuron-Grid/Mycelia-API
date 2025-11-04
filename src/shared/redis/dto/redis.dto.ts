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
