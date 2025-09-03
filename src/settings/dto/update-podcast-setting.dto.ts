import {
    IsBoolean,
    IsIn,
    IsOptional,
    IsString,
    Matches,
} from "class-validator";

export class UpdatePodcastSettingDto {
    /** ポッドキャスト機能の有効/無効 */
    @IsBoolean()
    enabled!: boolean;

    /** JST時刻 (HH:mm) */
    @IsOptional()
    @IsString()
    @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/)
    time?: string;

    /** 音声言語 */
    @IsOptional()
    @IsIn(["ja-JP", "en-US"])
    language?: "ja-JP" | "en-US";
}
