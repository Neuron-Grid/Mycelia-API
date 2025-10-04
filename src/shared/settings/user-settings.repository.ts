import { Injectable, Logger } from "@nestjs/common";
import {
    PODCAST_SCHEDULE_DEFAULT,
    SUMMARY_SCHEDULE_DEFAULT,
} from "@/settings/settings.constants";
import { SupabaseRequestService } from "@/supabase-request.service";
import { Tables, TablesInsert } from "@/types/schema";

type UserSettingsRow = Tables<"user_settings"> & {
    summary_schedule_time: string;
};

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
                .select("*")
                .eq("summary_enabled", true);

            if (error) throw error;

            const rows = (data ?? []) as unknown as UserSettingsRow[];
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

    async getAllEnabledPodcastSchedules(): Promise<PodcastSchedule[]> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from("user_settings")
                .select("*")
                .eq("podcast_enabled", true)
                .eq("summary_enabled", true);

            if (error) throw error;

            const rows = (data ?? []) as unknown as UserSettingsRow[];
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

    async getByUserId(userId: string): Promise<{
        user_id: string;
        summary_enabled: boolean;
        podcast_enabled: boolean;
        podcast_language?: "ja-JP" | "en-US";
        podcast_schedule_time?: string | null;
        summary_schedule_time: string;
    } | null> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from("user_settings")
                .select("*")
                .eq("user_id", userId)
                .single();
            if (error) throw error;
            if (!data) return null;
            const row = data as unknown as UserSettingsRow;
            const lang = row.podcast_language as "ja-JP" | "en-US" | null as
                | "ja-JP"
                | "en-US"
                | null;
            return {
                user_id: row.user_id as string,
                summary_enabled: row.summary_enabled as boolean,
                podcast_enabled: row.podcast_enabled as boolean,
                podcast_language: (lang ?? undefined) as
                    | "ja-JP"
                    | "en-US"
                    | undefined,
                podcast_schedule_time: (row.podcast_schedule_time ?? null) as
                    | string
                    | null,
                summary_schedule_time: row.summary_schedule_time,
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

    async upsertRefreshInterval(
        userId: string,
        refreshInterval: string,
    ): Promise<void> {
        const client = this.supabaseRequestService.getClient();
        const nowIso = new Date().toISOString();

        const { data: existing, error: selectError } = await client
            .from("user_settings")
            .select("user_id, refresh_every")
            .eq("user_id", userId)
            .maybeSingle();

        if (selectError && selectError.code !== "PGRST116") {
            this.logger.error(
                `Failed to read user settings before update: ${selectError.message}`,
                selectError.stack,
            );
            throw selectError;
        }

        const currentInterval = existing
            ? this.coerceInterval(existing.refresh_every)
            : null;

        if (existing) {
            if (currentInterval === refreshInterval) {
                this.logger.debug(
                    `Skip refresh interval update for user ${userId}: unchanged (${refreshInterval})`,
                );
                return;
            }
            const { error } = await client
                .from("user_settings")
                .update({
                    refresh_every: this.castInterval(refreshInterval),
                    updated_at: nowIso,
                })
                .eq("user_id", userId);

            if (error) {
                this.logger.error(
                    `Failed to update refresh interval for user ${userId}: ${error.message}`,
                    error.stack,
                );
                throw error;
            }
            return;
        }

        const insertPayload: TablesInsert<"user_settings"> = {
            user_id: userId,
            refresh_every: this.castInterval(refreshInterval),
            summary_enabled: false,
            summary_schedule_time: SUMMARY_SCHEDULE_DEFAULT,
            podcast_enabled: false,
            podcast_schedule_time: PODCAST_SCHEDULE_DEFAULT,
            podcast_language: "ja-JP",
            updated_at: nowIso,
        };

        const { error: insertError } = await client
            .from("user_settings")
            .insert(insertPayload);

        if (insertError) {
            this.logger.error(
                `Failed to insert user settings for ${userId}: ${insertError.message}`,
                insertError.stack,
            );
            throw insertError;
        }
    }

    private castInterval(
        value: string,
    ): TablesInsert<"user_settings">["refresh_every"] {
        return value as unknown as TablesInsert<"user_settings">["refresh_every"];
    }

    private coerceInterval(raw: unknown): string | null {
        if (raw === null || raw === undefined) return null;
        if (typeof raw === "string") return raw;
        return String(raw);
    }
}
