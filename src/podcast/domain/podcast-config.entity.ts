import { Database } from '../../types/schema'

// ポッドキャスト設定エンティティ
// @description user_settingsテーブルのポッドキャスト関連フィールドを表現
export interface PodcastConfig {
    // ユーザーID
    user_id: string
    // ポッドキャスト機能の有効/無効
    podcast_enabled: boolean
    // ポッドキャスト生成スケジュール時刻（HH:MM形式, 例: "07:30"）
    podcast_schedule_time: string | null
    // ポッドキャスト言語
    podcast_language: 'ja-JP' | 'en-US'
    // レコード作成日時（ISO8601）
    created_at: string
    // レコード更新日時（ISO8601）
    updated_at: string
    // user_settingsテーブルの他のフィールド
    refresh_every: string
}

// ポッドキャスト設定の作成・更新用DTO
// @description ポッドキャスト設定の部分更新・作成用
export interface PodcastConfigInput {
    // ポッドキャスト機能の有効/無効
    podcast_enabled?: boolean
    // ポッドキャスト生成スケジュール時刻（HH:MM形式, 例: "07:30"）
    podcast_schedule_time?: string | null
    // ポッドキャスト言語
    podcast_language?: 'ja-JP' | 'en-US'
}

// user_settingsテーブルの型定義
export type UserSettings = Database['public']['Tables']['user_settings']['Row']
