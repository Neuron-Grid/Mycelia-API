import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsBoolean,
    IsIn,
    IsOptional,
    IsString,
    Matches,
    ValidateNested,
} from "class-validator";
import { IntervalDto } from "../../feed/application/dto/subscription-interval.dto";

export class UpdateUserSettingsDto {
    @ApiPropertyOptional({
        description: "デフォルトのRSSフィード更新間隔",
        type: IntervalDto,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => IntervalDto)
    refresh_every?: IntervalDto;

    @ApiPropertyOptional({
        description: "ポッドキャスト機能の有効/無効",
        example: true,
    })
    @IsOptional()
    @IsBoolean()
    podcast_enabled?: boolean;

    @ApiPropertyOptional({
        description: "ポッドキャスト生成スケジュール時刻（HH:MM形式）",
        pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
        example: "07:30",
    })
    @IsOptional()
    @IsString()
    @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Schedule time must be in HH:MM format (24-hour)",
    })
    podcast_schedule_time?: string;

    @ApiPropertyOptional({
        description: "ポッドキャスト言語",
        enum: ["ja-JP", "en-US"],
        example: "ja-JP",
    })
    @IsOptional()
    @IsString()
    @IsIn(["ja-JP", "en-US"])
    podcast_language?: "ja-JP" | "en-US";

    // バリデーション: 設定値が有効かチェック
    isValid(): boolean {
        // 更新間隔の検証
        if (this.refresh_every && !this.refresh_every.isValidInterval()) {
            return false;
        }

        // ポッドキャスト有効時は言語とスケジュール時刻が必要
        if (this.podcast_enabled === true) {
            if (!this.podcast_language || !this.podcast_schedule_time) {
                return false;
            }
        }

        return true;
    }

    // エラーメッセージ取得
    getValidationMessages(): string[] {
        const messages: string[] = [];

        if (this.refresh_every && !this.refresh_every.isValidInterval()) {
            const totalMinutes = this.refresh_every.getTotalMinutes();
            if (totalMinutes < 5) {
                messages.push("更新間隔は最低5分以上である必要があります");
            }
            if (totalMinutes > 1440) {
                messages.push(
                    "更新間隔は最大24時間（1440分）以下である必要があります",
                );
            }
        }

        if (this.podcast_enabled === true) {
            if (!this.podcast_language) {
                messages.push(
                    "ポッドキャスト機能を有効にする場合は言語設定が必要です",
                );
            }
            if (!this.podcast_schedule_time) {
                messages.push(
                    "ポッドキャスト機能を有効にする場合はスケジュール時刻が必要です",
                );
            }
        }

        return messages;
    }

    // PostgreSQL用の変換
    toPostgresData(): Record<string, string | boolean | null | undefined> {
        const data: Record<string, string | boolean | null | undefined> = {};

        if (this.refresh_every) {
            data.refresh_every = this.refresh_every.toPostgresInterval();
        }

        if (this.podcast_enabled !== undefined) {
            data.podcast_enabled = this.podcast_enabled;
        }

        if (this.podcast_schedule_time !== undefined) {
            data.podcast_schedule_time = this.podcast_schedule_time;
        }

        if (this.podcast_language !== undefined) {
            data.podcast_language = this.podcast_language;
        }

        return data;
    }
}

export class UserSettingsResponseDto {
    @ApiProperty({
        description: "ユーザーID",
        example: "123e4567-e89b-12d3-a456-426614174000",
    })
    user_id!: string;

    @ApiProperty({
        description: "RSSフィード更新間隔",
        type: IntervalDto,
    })
    refresh_every!: IntervalDto;

    @ApiProperty({
        description: "ポッドキャスト機能の有効/無効",
        example: true,
    })
    podcast_enabled!: boolean;

    @ApiProperty({
        description: "ポッドキャスト生成スケジュール時刻",
        example: "07:30",
    })
    podcast_schedule_time!: string | null;

    @ApiProperty({
        description: "ポッドキャスト言語",
        example: "ja-JP",
    })
    podcast_language!: "ja-JP" | "en-US";

    @ApiProperty({
        description: "作成日時",
        example: "2023-12-01T00:00:00Z",
    })
    created_at!: string;

    @ApiProperty({
        description: "更新日時",
        example: "2023-12-01T00:00:00Z",
    })
    updated_at!: string;

    // ファクトリメソッド: データベースレコードから作成
    static fromDatabaseRecord(record: {
        user_id: string;
        refresh_every: string;
        podcast_enabled: boolean;
        podcast_schedule_time: string | null;
        podcast_language: "ja-JP" | "en-US";
        created_at: string;
        updated_at: string;
    }): UserSettingsResponseDto {
        const dto = new UserSettingsResponseDto();
        dto.user_id = record.user_id;
        dto.refresh_every = IntervalDto.fromPostgresInterval(
            record.refresh_every,
        );
        dto.podcast_enabled = record.podcast_enabled || false;
        dto.podcast_schedule_time = record.podcast_schedule_time;
        dto.podcast_language = record.podcast_language || "ja-JP";
        dto.created_at = record.created_at;
        dto.updated_at = record.updated_at;
        return dto;
    }

    // 人間が読みやすい形式でのサマリー
    getReadableSummary(): string {
        const parts = [`更新間隔: ${this.refresh_every.toHumanReadable()}`];

        if (this.podcast_enabled) {
            parts.push(
                `ポッドキャスト: 有効（${this.podcast_schedule_time}、${this.podcast_language}）`,
            );
        } else {
            parts.push("ポッドキャスト: 無効");
        }

        return parts.join(", ");
    }
}
