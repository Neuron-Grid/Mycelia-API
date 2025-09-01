import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SettingsOverviewDto {
    @ApiProperty({ description: "要約機能の有効/無効" })
    summaryEnabled!: boolean;

    @ApiProperty({ description: "ポッドキャスト機能の有効/無効" })
    podcastEnabled!: boolean;

    @ApiPropertyOptional({
        description: "ポッドキャスト実行時刻 (JST, HH:mm)",
        nullable: true,
    })
    podcastScheduleTime!: string | null;

    @ApiProperty({
        description: "ポッドキャスト言語",
        enum: ["ja-JP", "en-US"],
    })
    podcastLanguage!: "ja-JP" | "en-US";

    @ApiPropertyOptional({
        description: "次回要約実行予定日時 (ISO)",
        nullable: true,
    })
    nextRunAtSummary!: string | null;

    @ApiPropertyOptional({
        description: "次回ポッドキャスト実行予定日時 (ISO)",
        nullable: true,
    })
    nextRunAtPodcast!: string | null;

    @ApiPropertyOptional({
        description: "直近の要約更新日時 (ISO)",
        nullable: true,
    })
    lastSummaryAt!: string | null;

    @ApiPropertyOptional({
        description: "直近のポッドキャスト更新日時 (ISO)",
        nullable: true,
    })
    lastPodcastAt!: string | null;

    @ApiProperty({
        description: "直近ステータス",
        enum: ["success", "failed", "skipped", "unknown"],
    })
    lastStatus!: "success" | "failed" | "skipped" | "unknown";
}
