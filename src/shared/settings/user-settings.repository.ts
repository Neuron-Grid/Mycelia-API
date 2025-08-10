import { Injectable, Logger } from "@nestjs/common";
import { SupabaseRequestService } from "src/supabase-request.service";
import { Tables } from "src/types/schema";

export type SummarySchedule = {
    userId: string;
    timeJst: string; // "HH:mm"
};

export type PodcastSchedule = {
    userId: string;
    timeJst: string; // "HH:mm"
    language?: "ja-JP" | "en-US";
};

@Injectable()
export class UserSettingsRepository {
    private readonly logger = new Logger(UserSettingsRepository.name);

    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
    ) {}

    async getAllEnabledSummarySchedules(): Promise<SummarySchedule[]> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
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

    async getAllEnabledPodcastSchedules(): Promise<PodcastSchedule[]> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
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

    async getByUserId(userId: string): Promise<{
        user_id: string;
        summary_enabled: boolean;
        podcast_enabled: boolean;
        podcast_language?: "ja-JP" | "en-US";
    } | null> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from("user_settings")
                .select(
                    "user_id, summary_enabled, podcast_enabled, podcast_language",
                )
                .eq("user_id", userId)
                .single();
            if (error) throw error;
            if (!data) return null;
            const lang = data.podcast_language as "ja-JP" | "en-US" | null as
                | "ja-JP"
                | "en-US"
                | null;
            return {
                user_id: data.user_id as string,
                summary_enabled: data.summary_enabled as boolean,
                podcast_enabled: data.podcast_enabled as boolean,
                podcast_language: (lang ?? undefined) as
                    | "ja-JP"
                    | "en-US"
                    | undefined,
            };
        } catch (e) {
            this.logger.warn(
                `Failed to load settings for user ${userId}: ${(e as Error).message}`,
            );
            return null;
        }
    }
}
