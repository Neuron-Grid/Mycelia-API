import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PodcastEpisodeEntity } from "@/podcast/domain/podcast-episode.entity";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { Database } from "@/types/schema";

// RPC戻り値の型定義
type PodcastEpisodeRow =
    Database["public"]["Tables"]["podcast_episodes"]["Row"];
type FnListOldPodcastEpisodesRow =
    Database["public"]["Functions"]["fn_list_old_podcast_episodes"]["Returns"][number];
type FnFindPodcastByIdRow =
    Database["public"]["Functions"]["fn_find_podcast_by_id"]["Returns"][number];
type FnFindPodcastBySummaryIdRow =
    Database["public"]["Functions"]["fn_find_podcast_by_summary_id"]["Returns"][number];

@Injectable()
export class WorkerPodcastEpisodeRepository {
    private readonly logger = new Logger(WorkerPodcastEpisodeRepository.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    /**
     * サマリーIDによるポッドキャスト検索（RPC経由）
     * A+ Architecture: 直接テーブル操作を禁止し、RPC経由でアクセス
     */
    async findBySummaryId(
        userId: string,
        summaryId: number,
    ): Promise<PodcastEpisodeEntity | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc(
                "fn_find_podcast_by_summary_id",
                { p_user_id: userId, p_summary_id: summaryId },
            );
            if (error) throw error;
            const rows = data ?? [];
            if (rows.length === 0) return null;
            return new PodcastEpisodeEntity(
                rows[0] as FnFindPodcastBySummaryIdRow,
            );
        } catch (e) {
            this.logger.error(`findBySummaryId: ${(e as Error).message}`);
            return null;
        }
    }

    /**
     * ポッドキャストエピソードのUPSERT
     * A+ Architecture: 既にRPC経由で実装済み
     */
    async upsert(
        userId: string,
        summaryId: number,
        title: string,
        titleEmb?: number[],
    ): Promise<PodcastEpisodeEntity> {
        const sb = this.admin.getClient();
        const { data, error } = await sb.rpc("fn_upsert_podcast_episode", {
            p_user_id: userId,
            p_summary_id: summaryId,
            p_title: title,
            // RPC型が number[] を要求するため、未指定時は null を明示的にキャスト
            p_title_emb: (titleEmb ?? null) as unknown as number[],
        });
        if (error) throw error as Error;
        return new PodcastEpisodeEntity(data as PodcastEpisodeRow);
    }

    /**
     * 音声URL更新
     * A+ Architecture: 既にRPC経由で実装済み
     */
    async updateAudioUrl(
        episodeId: number,
        userId: string,
        audioUrl: string,
        durationSec: number,
    ): Promise<PodcastEpisodeEntity> {
        const sb = this.admin.getClient();
        const { data, error } = await sb.rpc("fn_update_podcast_audio_url", {
            p_user_id: userId,
            p_episode_id: episodeId,
            p_audio_url: audioUrl,
            p_duration_sec: durationSec,
        });
        if (error) throw error as Error;
        if (!data) throw new NotFoundException();
        return new PodcastEpisodeEntity(data as PodcastEpisodeRow);
    }

    /**
     * IDによるポッドキャスト検索（RPC経由）
     * A+ Architecture: 直接テーブル操作を禁止し、RPC経由でアクセス
     */
    async findById(
        id: number,
        userId: string,
    ): Promise<PodcastEpisodeEntity | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb.rpc("fn_find_podcast_by_id", {
                p_user_id: userId,
                p_id: id,
            });
            if (error) throw error;
            const rows = data ?? [];
            if (rows.length === 0) return null;
            return new PodcastEpisodeEntity(rows[0] as FnFindPodcastByIdRow);
        } catch (e) {
            this.logger.error(`findById: ${(e as Error).message}`);
            return null;
        }
    }

    /**
     * 古いエピソードの列挙
     * A+ Architecture: 既にRPC経由で実装済み
     */
    async findOldEpisodes(
        userId: string,
        daysOld: number,
    ): Promise<PodcastEpisodeEntity[]> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysOld);
        const sb = this.admin.getClient();
        const { data, error } = await sb.rpc("fn_list_old_podcast_episodes", {
            p_user_id: userId,
            p_cutoff: cutoff.toISOString(),
        });
        if (error) {
            this.logger.error(`fn_list_old_podcast_episodes: ${error.message}`);
            return [];
        }
        const rows = (data ?? []) as FnListOldPodcastEpisodesRow[];
        return rows.map(
            (row) =>
                new PodcastEpisodeEntity({
                    id: row.id,
                    audio_url: row.audio_url,
                }),
        );
    }

    /**
     * ソフトデリート
     * A+ Architecture: 既にRPC経由で実装済み
     */
    async softDelete(id: number, userId: string): Promise<void> {
        const sb = this.admin.getClient();
        const { error } = await sb.rpc("fn_soft_delete_podcast_episode", {
            p_user_id: userId,
            p_episode_id: id,
        });
        if (error) throw error as Error;
    }
}
