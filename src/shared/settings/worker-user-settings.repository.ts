import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { Tables } from "@/types/schema";

export type WorkerSummarySchedule = {
    userId: string;
    timeJst: string; // "HH:mm"
};

export type WorkerPodcastSchedule = {
    userId: string;
    timeJst: string; // "HH:mm"
    language?: "ja-JP" | "en-US";
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
    } | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb
                .from("user_settings")
                .select(
                    "user_id, summary_enabled, podcast_enabled, podcast_language, podcast_schedule_time",
                )
                .eq("user_id", userId)
                .single();

            if (error) throw error;
            if (!data) return null;

            const row = data as Tables<"user_settings">;
            const lang = row.podcast_language as "ja-JP" | "en-US" | null;
            return {
                user_id: row.user_id,
                summary_enabled: row.summary_enabled,
                podcast_enabled: row.podcast_enabled,
                podcast_language: lang ?? undefined,
                podcast_schedule_time: row.podcast_schedule_time ?? null,
            };
        } catch (e) {
            this.logger.warn(
                `Failed to load settings for user ${userId}: ${(e as Error).message}`,
            );
            return null;
        }
    }

    async getAllEnabledSummarySchedules(): Promise<WorkerSummarySchedule[]> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb
                .from("user_settings")
                .select("user_id, summary_enabled, podcast_schedule_time")
                .eq("summary_enabled", true);

            if (error) throw error;

            const rows = (data || []) as Tables<"user_settings">[];
            return rows.map((row) => ({
                userId: row.user_id,
                timeJst: row.podcast_schedule_time || "06:00",
            }));
        } catch (e) {
            this.logger.error(
                `Failed to load summary schedules: ${(e as Error).message}`,
            );
            return [];
        }
    }

    async getAllEnabledPodcastSchedules(): Promise<WorkerPodcastSchedule[]> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb
                .from("user_settings")
                .select(
                    "user_id, podcast_enabled, podcast_schedule_time, podcast_language, summary_enabled",
                )
                .eq("podcast_enabled", true)
                .eq("summary_enabled", true);

            if (error) throw error;

            const rows = (data || []) as Tables<"user_settings">[];
            return rows.map((row) => ({
                userId: row.user_id,
                timeJst: row.podcast_schedule_time || "07:00",
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
