import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min, ValidateNested } from "class-validator";

export class IntervalDto {
    /** Hours (0-23) */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(23)
    hours = 0;

    /** Minutes (0-59) */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(59)
    minutes = 5;

    // ビジネスロジック: 総分数を計算
    getTotalMinutes(): number {
        return this.hours * 60 + this.minutes;
    }

    // ビジネスロジック: 最低5分の制限をチェック
    isValidInterval(): boolean {
        const totalMinutes = this.getTotalMinutes();
        return totalMinutes >= 5 && totalMinutes <= 1440; // 5分～24時間
    }

    // ビジネスロジック: PostgreSQLのinterval形式に変換
    toPostgresInterval(): string {
        const totalMinutes = this.getTotalMinutes();
        return `${totalMinutes} minutes`;
    }

    // ビジネスロジック: 人間が読みやすい形式に変換
    toHumanReadable(): string {
        const totalMinutes = this.getTotalMinutes();

        if (totalMinutes < 60) {
            return `${totalMinutes}分`;
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (minutes === 0) {
            return `${hours}時間`;
        }

        return `${hours}時間${minutes}分`;
    }

    // 静的メソッド: PostgreSQLのintervalから作成
    static fromPostgresInterval(intervalString: string): IntervalDto {
        const dto = new IntervalDto();

        // "HH:MM:SS" または "X minutes" または "X hours Y minutes" 形式を解析
        const timeMatch = intervalString.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
            dto.hours = Number.parseInt(timeMatch[1], 10);
            dto.minutes = Number.parseInt(timeMatch[2], 10);
            return dto;
        }

        const minutesMatch = intervalString.match(/(\d+)\s*minutes?/);
        if (minutesMatch) {
            const totalMinutes = Number.parseInt(minutesMatch[1], 10);
            dto.hours = Math.floor(totalMinutes / 60);
            dto.minutes = totalMinutes % 60;
            return dto;
        }

        return dto; // デフォルト値（0時間5分）
    }
}

export class UpdateSubscriptionIntervalDto {
    /** Refresh interval settings */
    @ValidateNested()
    @Type(() => IntervalDto)
    interval!: IntervalDto;

    // バリデーション: 間隔が有効かチェック
    isValid(): boolean {
        return this.interval.isValidInterval();
    }

    // エラーメッセージ取得
    getValidationMessage(): string {
        if (!this.interval.isValidInterval()) {
            const totalMinutes = this.interval.getTotalMinutes();
            if (totalMinutes < 5) {
                return "更新間隔は最低5分以上である必要があります";
            }
            if (totalMinutes > 1440) {
                return "更新間隔は最大24時間（1440分）以下である必要があります";
            }
        }
        return "";
    }
}
