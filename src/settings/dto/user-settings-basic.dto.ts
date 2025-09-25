/**
 * ユーザー設定（基本） DTO
 */

export class UserSettingsBasicDto {
    /** 要約機能の有効/無効 */
    summaryEnabled!: boolean;

    /** 要約実行時刻 (JST, HH:mm) */
    summaryScheduleTime!: string;

    /** ポッドキャスト機能の有効/無効 */
    podcastEnabled!: boolean;

    /** ポッドキャスト実行時刻 (JST, HH:mm) */
    podcastScheduleTime!: string | null;

    /** ポッドキャスト言語 */
    podcastLanguage!: "ja-JP" | "en-US";
}
