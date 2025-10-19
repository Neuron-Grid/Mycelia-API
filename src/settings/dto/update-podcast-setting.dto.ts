import {
    IsBoolean,
    IsIn,
    IsOptional,
    IsString,
    Matches,
} from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class UpdatePodcastSettingDto {
    /** ポッドキャスト機能の有効/無効 */
    @AcceptSnakeCase()
    @IsBoolean()
    enabled!: boolean;

    /** JST時刻 (HH:mm) */
    @AcceptSnakeCase()
    @IsOptional()
    @IsString()
    @Matches(/^([0-1]?\d|2[0-3]):[0-5]\d$/)
    time?: string;

    /** 音声言語 */
    @AcceptSnakeCase()
    @IsOptional()
    @IsIn(["ja-JP", "en-US"])
    language?: "ja-JP" | "en-US";
}
