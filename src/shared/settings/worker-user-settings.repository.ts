import { Injectable, Logger } from "@nestjs/common";
import { PODCAST_SCHEDULE_DEFAULT } from "@/settings/settings.constants";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { Tables } from "@/types/schema";

type WorkerUserSettingsRow = Tables<"user_settings"> & {
    summary_schedule_time: string;
};

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

@Injectable()
export class WorkerUserSettingsRepository {
    private readonly logger = new Logger(WorkerUserSettingsRepository.name);

    constructor(private readonly admin: SupabaseAdminService) {}

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
            const { data, error } = await sb
                .from("user_settings")
                .select("*")
                .eq("user_id", userId)
                .single();

            if (error) throw error;
            if (!data) return null;

            const row = data as unknown as WorkerUserSettingsRow;
            const lang = row.podcast_language as "ja-JP" | "en-US" | null;
            return {
                user_id: row.user_id,
                summary_enabled: row.summary_enabled,
                podcast_enabled: row.podcast_enabled,
                podcast_language: lang ?? undefined,
                podcast_schedule_time: row.podcast_schedule_time ?? null,
                summary_schedule_time: row.summary_schedule_time,
            };
        } catch (e) {
            this.logger.warn(
                `Failed to load settings for user ${userId}: ${(e as Error).message}`,
            );
            return null;
        }
    }

    async getAllEnabledSummarySchedules(
        options: PaginationOptions = {},
    ): Promise<WorkerSummarySchedule[]> {
        const { offset, limit } = options;
        try {
            const sb = this.admin.getClient();
            let query = sb
                .from("user_settings")
                .select("user_id, summary_schedule_time")
                .eq("summary_enabled", true)
                .eq("soft_deleted", false)
                .order("user_id", { ascending: true });

            if (
                typeof offset === "number" &&
                typeof limit === "number" &&
                limit > 0
            ) {
                query = query.range(offset, offset + limit - 1);
            } else if (typeof limit === "number" && limit > 0) {
                query = query.limit(limit);
            }

            const { data, error } = await query;

            if (error) throw error;

            const rows = (data ?? []) as unknown as WorkerUserSettingsRow[];
            return rows.map((row) => ({
                userId: row.user_id,
                timeJst: row.summary_schedule_time,
            }));
        } catch (e) {
            this.logger.error(
                `Failed to load summary schedules: ${(e as Error).message}`,
            );
            return [];
        }
    }

    async getAllEnabledPodcastSchedules(
        options: PaginationOptions = {},
    ): Promise<WorkerPodcastSchedule[]> {
        const { offset, limit } = options;
        try {
            const sb = this.admin.getClient();
            let query = sb
                .from("user_settings")
                .select("user_id, podcast_schedule_time, podcast_language")
                .eq("podcast_enabled", true)
                .eq("summary_enabled", true)
                .eq("soft_deleted", false)
                .order("user_id", { ascending: true });

            if (
                typeof offset === "number" &&
                typeof limit === "number" &&
                limit > 0
            ) {
                query = query.range(offset, offset + limit - 1);
            } else if (typeof limit === "number" && limit > 0) {
                query = query.limit(limit);
            }

            const { data, error } = await query;

            if (error) throw error;

            const rows = (data ?? []) as unknown as WorkerUserSettingsRow[];
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
