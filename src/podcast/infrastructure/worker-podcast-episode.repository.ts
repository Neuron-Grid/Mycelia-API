import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PodcastEpisodeEntity } from "@/podcast/domain/podcast-episode.entity";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";

@Injectable()
export class WorkerPodcastEpisodeRepository {
    private readonly logger = new Logger(WorkerPodcastEpisodeRepository.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    async findBySummaryId(
        userId: string,
        summaryId: number,
    ): Promise<PodcastEpisodeEntity | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb
                .from("podcast_episodes")
                .select("*")
                .eq("user_id", userId)
                .eq("summary_id", summaryId)
                .eq("soft_deleted", false)
                .single();
            if (error) {
                const code = (error as { code?: string }).code;
                if (code === "PGRST116") return null;
                throw error;
            }
            return new PodcastEpisodeEntity(data as PodcastEpisodeEntity);
        } catch (e) {
            this.logger.error(`findBySummaryId: ${(e as Error).message}`);
            return null;
        }
    }

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
        return new PodcastEpisodeEntity(data as PodcastEpisodeEntity);
    }

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
        return new PodcastEpisodeEntity(data as PodcastEpisodeEntity);
    }

    async findById(
        id: number,
        userId: string,
    ): Promise<PodcastEpisodeEntity | null> {
        try {
            const sb = this.admin.getClient();
            const { data, error } = await sb
                .from("podcast_episodes")
                .select("*")
                .eq("id", id)
                .eq("user_id", userId)
                .eq("soft_deleted", false)
                .single();
            if (error) {
                const code = (error as { code?: string }).code;
                if (code === "PGRST116") return null;
                throw error;
            }
            return new PodcastEpisodeEntity(data as PodcastEpisodeEntity);
        } catch (e) {
            this.logger.error(`findById: ${(e as Error).message}`);
            return null;
        }
    }

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
        return (data || []).map(
            (d) =>
                new PodcastEpisodeEntity({
                    id: (d as { id: number }).id,
                    audio_url: (d as { audio_url: string }).audio_url,
                }),
        );
    }

    async softDelete(id: number, userId: string): Promise<void> {
        const sb = this.admin.getClient();
        const { error } = await sb.rpc("fn_soft_delete_podcast_episode", {
            p_user_id: userId,
            p_episode_id: id,
        });
        if (error) throw error as Error;
    }
}
