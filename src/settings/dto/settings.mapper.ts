import type { SettingsOverviewDto } from "./settings-overview.dto";

export type SettingsOverviewSource = {
    summary_enabled: boolean;
    summary_schedule_time: string;
    podcast_enabled: boolean;
    podcast_schedule_time: string | null;
    podcast_language: "ja-JP" | "en-US";
    next_run_at_summary: string | null;
    next_run_at_podcast: string | null;
    last_summary_at: string | null;
    last_podcast_at: string | null;
    last_status: "success" | "failed" | "skipped" | "unknown";
};

export const SettingsMapper = {
    toDto(src: SettingsOverviewSource): SettingsOverviewDto {
        return {
            summaryEnabled: src.summary_enabled,
            summaryScheduleTime: src.summary_schedule_time,
            podcastEnabled: src.podcast_enabled,
            podcastScheduleTime: src.podcast_schedule_time,
            podcastLanguage: src.podcast_language,
            nextRunAtSummary: src.next_run_at_summary,
            nextRunAtPodcast: src.next_run_at_podcast,
            lastSummaryAt: src.last_summary_at,
            lastPodcastAt: src.last_podcast_at,
            lastStatus: src.last_status,
        };
    },
};
