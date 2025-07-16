import { Injectable, Logger } from "@nestjs/common";
import { SupabaseRequestService } from "../../supabase-request.service";
import {
    PodcastConfig,
    PodcastConfigInput,
} from "../domain/podcast-config.entity";

// ポッドキャスト設定リポジトリ
// user_settingsテーブルを使用してポッドキャスト設定を管理
@Injectable()
export class PodcastConfigRepository {
    private readonly tableName = "user_settings";
    private readonly logger = new Logger(PodcastConfigRepository.name);

    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
    ) {}

    // ユーザーのポッドキャスト設定を取得
    // @param userId ユーザーID
    // @returns ポッドキャスト設定（存在しない場合はnull）
    async findByUserId(userId: string): Promise<PodcastConfig | null> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from(this.tableName)
                .select("*")
                .eq("user_id", userId)
                .single();

            if (error) {
                // データが存在しない場合はnullを返す
                if (error.code === "PGRST116") {
                    return null;
                }
                throw error;
            }

            return data as unknown as PodcastConfig;
        } catch (error) {
            this.logger.error(
                `ポッドキャスト設定の取得に失敗: ${error.message}`,
            );
            return null;
        }
    }

    // ポッドキャスト設定を作成または更新
    // @param userId ユーザーID
    // @param input 設定内容
    // @returns 作成/更新されたポッドキャスト設定
    async upsert(
        userId: string,
        input: PodcastConfigInput,
    ): Promise<PodcastConfig | null> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from(this.tableName)
                .upsert(
                    {
                        user_id: userId,
                        ...input,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: "user_id" },
                )
                .select()
                .single();

            if (error) throw error;
            return data as unknown as PodcastConfig;
        } catch (error) {
            this.logger.error(
                `ポッドキャスト設定の更新に失敗: ${error.message}`,
            );
            return null;
        }
    }

    // 指定時刻に実行すべき有効なポッドキャスト設定を取得
    // @param scheduleTime HH:MM形式の時刻（例: "07:30"）
    // @returns ポッドキャスト設定の配列
    async findEnabledByScheduleTime(
        scheduleTime: string,
    ): Promise<PodcastConfig[]> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from(this.tableName)
                .select("*")
                .eq("podcast_enabled", true)
                .eq("podcast_schedule_time", scheduleTime);

            if (error) throw error;
            return data as unknown as PodcastConfig[];
        } catch (error) {
            this.logger.error(
                `スケジュール時刻のポッドキャスト設定取得に失敗: ${error.message}`,
            );
            return [];
        }
    }
}
