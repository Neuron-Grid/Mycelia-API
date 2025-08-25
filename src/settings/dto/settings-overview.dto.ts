import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SettingsOverviewDto {
    @ApiProperty({ description: "要約機能の有効/無効" })
    summary_enabled!: boolean;

    @ApiProperty({ description: "ポッドキャスト機能の有効/無効" })
    podcast_enabled!: boolean;

    @ApiPropertyOptional({
        description: "ポッドキャスト実行時刻 (JST, HH:mm)",
        nullable: true,
    })
    podcast_schedule_time!: string | null;

    @ApiProperty({
        description: "ポッドキャスト言語",
        enum: ["ja-JP", "en-US"],
    })
    podcast_language!: "ja-JP" | "en-US";

    @ApiPropertyOptional({
        description: "次回要約実行予定日時 (ISO)",
        nullable: true,
    })
    next_run_at_summary!: string | null;

    @ApiPropertyOptional({
        description: "次回ポッドキャスト実行予定日時 (ISO)",
        nullable: true,
    })
    next_run_at_podcast!: string | null;

    @ApiPropertyOptional({
        description: "直近の要約更新日時 (ISO)",
        nullable: true,
    })
    last_summary_at!: string | null;

    @ApiPropertyOptional({
        description: "直近のポッドキャスト更新日時 (ISO)",
        nullable: true,
    })
    last_podcast_at!: string | null;

    @ApiProperty({
        description: "直近ステータス",
        enum: ["success", "failed", "skipped", "unknown"],
    })
    last_status!: "success" | "failed" | "skipped" | "unknown";
}
