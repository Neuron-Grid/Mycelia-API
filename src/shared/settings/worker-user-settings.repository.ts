import { Injectable, Logger } from "@nestjs/common";
import { PODCAST_SCHEDULE_DEFAULT } from "@/settings/settings.constants";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { Database } from "@/types/schema";

export type WorkerSummarySchedule = {
    userId: string;
    timeJst: string; // "HH:mm"
};

export type WorkerPodcastSchedule = {
    userId: string;
    timeJst: string; // "HH:mm"
    language?: "ja-JP" | "en-US";
};

type PaginationOptions = {
    offset?: number;
    limit?: number;
};

// RPC戻り値の型定義
type FnGetUserSettingsRow =
    Database["public"]["Functions"]["fn_get_user_settings"]["Returns"][number];
type FnListSummarySchedulesRow =
    Database["public"]["Functions"]["fn_list_enabled_summary_schedules"]["Returns"][number];
type FnListPodcastSchedulesRow =
    Database["public"]["Functions"]["fn_list_enabled_podcast_schedules"]["Returns"][number];

@Injectable()
export class WorkerUserSettingsRepository {
    private readonly logger = new Logger(WorkerUserSettingsRepository.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    /**
     * ユーザー設定を取得（RPC経由）
     * A+ Architecture: 直接テーブル操作を禁止し、RPC経由でアクセス
     */
    async getByUserId(userId: string): Promise<{
        user_id: string;
        summary_enabled: boolean;
        podcast_enabled: boolean;
        podcast_language?: "ja-JP" | "en-US";
        podcast_schedule_time?: string | null;
        summary_schedule_time: string;
    } | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc("fn_get_user_settings", {
                p_user_id: userId,
            });

            if (error) throw error;
            const rows = (data ?? []) as FnGetUserSettingsRow[];
            if (rows.length === 0) return null;

            const row = rows[0];
            const lang = row.podcast_language as "ja-JP" | "en-US" | null;
            return {
                user_id: row.user_id,
                summary_enabled: row.summary_enabled,
                podcast_enabled: row.podcast_enabled,
                podcast_language: lang ?? undefined,
                podcast_schedule_time: row.podcast_schedule_time ?? null,
                summary_schedule_time: row.summary_schedule_time ?? "09:00",
            };
        } catch (e) {
            this.logger.warn(
                `Failed to load settings for user ${userId}: ${
                    (e as Error).message
                }`,
            );
            return null;
        }
    }

    /**
     * 有効なサマリースケジュール一覧を取得（RPC経由）
     * A+ Architecture: 直接テーブル操作を禁止し、RPC経由でアクセス
     */
    async getAllEnabledSummarySchedules(
        options: PaginationOptions = {},
    ): Promise<WorkerSummarySchedule[]> {
        const { offset = 0, limit = 1000 } = options;
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc(
                "fn_list_enabled_summary_schedules",
                {
                    p_offset: offset,
                    p_limit: limit,
                },
            );

            if (error) throw error;

            const rows = (data ?? []) as FnListSummarySchedulesRow[];
            return rows.map((row) => ({
                userId: row.user_id,
                timeJst: row.summary_schedule_time ?? "09:00",
            }));
        } catch (e) {
            this.logger.error(
                `Failed to load summary schedules: ${(e as Error).message}`,
            );
            return [];
        }
    }

    /**
     * 有効なポッドキャストスケジュール一覧を取得（RPC経由）
     * A+ Architecture: 直接テーブル操作を禁止し、RPC経由でアクセス
     */
    async getAllEnabledPodcastSchedules(
        options: PaginationOptions = {},
    ): Promise<WorkerPodcastSchedule[]> {
        const { offset = 0, limit = 1000 } = options;
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc(
                "fn_list_enabled_podcast_schedules",
                {
                    p_offset: offset,
                    p_limit: limit,
                },
            );

            if (error) throw error;

            const rows = (data ?? []) as FnListPodcastSchedulesRow[];
            return rows.map((row) => ({
                userId: row.user_id,
                timeJst: row.podcast_schedule_time || PODCAST_SCHEDULE_DEFAULT,
                language:
                    (row.podcast_language as "ja-JP" | "en-US") || undefined,
            }));
        } catch (e) {
            this.logger.error(
                `Failed to load podcast schedules: ${(e as Error).message}`,
            );
            return [];
        }
    }
}
