import { SUMMARY_SCHEDULE_DEFAULT } from "@/settings/settings.constants";
import type { UserSettingsBasicDto } from "./user-settings-basic.dto";

export const UserSettingsBasicMapper = {
    fromRepoRow(
        row: {
            user_id: string;
            summary_enabled: boolean;
            summary_schedule_time: string;
            podcast_enabled: boolean;
            podcast_language?: "ja-JP" | "en-US" | null;
            podcast_schedule_time?: string | null;
        } | null,
    ): UserSettingsBasicDto {
        return {
            summaryEnabled: row?.summary_enabled ?? false,
            summaryScheduleTime:
                row?.summary_schedule_time ?? SUMMARY_SCHEDULE_DEFAULT,
            podcastEnabled: row?.podcast_enabled ?? false,
            podcastScheduleTime: row?.podcast_schedule_time ?? null,
            podcastLanguage: (row?.podcast_language === "en-US"
                ? "en-US"
                : "ja-JP") as "ja-JP" | "en-US",
        };
    },
};
