import { ApiProperty } from "@nestjs/swagger";

export class UserSettingsBasicDto {
    @ApiProperty({ description: "要約機能の有効/無効" })
    summaryEnabled!: boolean;

    @ApiProperty({ description: "ポッドキャスト機能の有効/無効" })
    podcastEnabled!: boolean;

    @ApiProperty({
        description: "ポッドキャスト実行時刻 (JST, HH:mm)",
        nullable: true,
    })
    podcastScheduleTime!: string | null;

    @ApiProperty({
        description: "ポッドキャスト言語",
        enum: ["ja-JP", "en-US"],
    })
    podcastLanguage!: "ja-JP" | "en-US";
}
