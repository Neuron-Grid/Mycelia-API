import type { UserSettingsBasicDto } from "./user-settings-basic.dto";

export const UserSettingsBasicMapper = {
    fromRepoRow(
        row: {
            user_id: string;
            summary_enabled: boolean;
            podcast_enabled: boolean;
            podcast_language?: "ja-JP" | "en-US" | null;
            podcast_schedule_time?: string | null;
        } | null,
    ): UserSettingsBasicDto {
        return {
            summaryEnabled: row?.summary_enabled ?? false,
            podcastEnabled: row?.podcast_enabled ?? false,
            podcastScheduleTime: row?.podcast_schedule_time ?? null,
            podcastLanguage: (row?.podcast_language === "en-US"
                ? "en-US"
                : "ja-JP") as "ja-JP" | "en-US",
        };
    },
};
