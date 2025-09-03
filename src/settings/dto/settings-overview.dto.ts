/**
 * 設定の概要 DTO
 */

export class SettingsOverviewDto {
    /** 要約機能の有効/無効 */
    summaryEnabled!: boolean;

    /** ポッドキャスト機能の有効/無効 */
    podcastEnabled!: boolean;

    /** ポッドキャスト実行時刻 (JST, HH:mm) */
    podcastScheduleTime!: string | null;

    /** ポッドキャスト言語 */
    podcastLanguage!: "ja-JP" | "en-US";

    /** 次回要約実行予定日時 (ISO) */
    nextRunAtSummary!: string | null;

    /** 次回ポッドキャスト実行予定日時 (ISO) */
    nextRunAtPodcast!: string | null;

    /** 直近の要約更新日時 (ISO) */
    lastSummaryAt!: string | null;

    /** 直近のポッドキャスト更新日時 (ISO) */
    lastPodcastAt!: string | null;

    /** 直近ステータス */
    lastStatus!: "success" | "failed" | "skipped" | "unknown";
}
