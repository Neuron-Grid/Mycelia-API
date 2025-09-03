import { SettingsOverviewDto } from "@/settings/dto/settings-overview.dto";

/** 設定概要レスポンス（非ジェネリックのエンベロープ） */
export class SettingsOverviewResponseDto {
    /** 人間可読メッセージ */
    message!: string;
    /** 本体 */
    data!: SettingsOverviewDto | null;
}
