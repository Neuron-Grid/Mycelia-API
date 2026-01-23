export const buildSummaryJobId = (userId: string, dateJst: string): string =>
    `summary:${userId}:${dateJst}`;

export const buildScriptJobId = (summaryId: number): string =>
    `script:${summaryId}`;

export const buildScriptByDateJobId = (
    userId: string,
    dateJst: string,
): string => `script-by-date:${userId}:${dateJst}`;

export const buildPodcastJobId = (userId: string, summaryId: number): string =>
    `podcast:${userId}:${summaryId}`;

export const buildPodcastForTodayJobId = (
    userId: string,
    dateJst: string,
): string => `podcast-for-today:${userId}:${dateJst}`;
