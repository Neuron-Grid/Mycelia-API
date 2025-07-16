import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseRequestService } from '../../supabase-request.service';
import { PodcastEpisodeEntity } from '../domain/podcast-episode.entity';

@Injectable()
export class PodcastEpisodeRepository {
    private readonly logger = new Logger(PodcastEpisodeRepository.name);

    constructor(private readonly supabaseRequestService: SupabaseRequestService) {}

    // 指定ユーザーの指定要約IDのエピソードを取得
    async findBySummaryId(userId: string, summaryId: number): Promise<PodcastEpisodeEntity | null> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('podcast_episodes')
                .select('*')
                .eq('user_id', userId)
                .eq('summary_id', summaryId)
                .eq('soft_deleted', false)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }

            return new PodcastEpisodeEntity(data);
        } catch (error) {
            this.logger.error(`Failed to find podcast episode by summary ID: ${error.message}`);
            return null;
        }
    }

    // エピソードの作成
    async create(
        userId: string,
        summaryId: number,
        data: {
            title?: string;
            title_embedding?: number[];
            audio_url?: string;
        },
    ): Promise<PodcastEpisodeEntity> {
        try {
            const { data: result, error } = await this.supabaseRequestService
                .getClient()
                .from('podcast_episodes')
                .insert({
                    user_id: userId,
                    summary_id: summaryId,
                    title: data.title || null,
                    title_embedding: data.title_embedding || null,
                    audio_url: data.audio_url || null,
                    soft_deleted: false,
                })
                .select()
                .single();

            if (error) throw error;
            return new PodcastEpisodeEntity(result);
        } catch (error) {
            this.logger.error(`Failed to create podcast episode: ${error.message}`);
            throw error;
        }
    }

    // エピソードの更新
    async update(
        id: number,
        userId: string,
        data: {
            title?: string;
            title_embedding?: number[];
            audio_url?: string;
        },
    ): Promise<PodcastEpisodeEntity> {
        try {
            const { data: result, error } = await this.supabaseRequestService
                .getClient()
                .from('podcast_episodes')
                .update({
                    ...data,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('user_id', userId) // ユーザー分離の保証
                .eq('soft_deleted', false)
                .select()
                .single();

            if (error) throw error;
            if (!result) {
                throw new NotFoundException('Podcast episode not found or access denied');
            }

            return new PodcastEpisodeEntity(result);
        } catch (error) {
            this.logger.error(`Failed to update podcast episode: ${error.message}`);
            throw error;
        }
    }

    // 指定ユーザーのエピソード一覧取得（ページネーション対応）
    async findByUser(
        userId: string,
        limit = 20,
        offset = 0,
    ): Promise<{
        episodes: PodcastEpisodeEntity[];
        total: number;
    }> {
        try {
            // 総数を取得
            const { count, error: countError } = await this.supabaseRequestService
                .getClient()
                .from('podcast_episodes')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('soft_deleted', false);

            if (countError) throw countError;

            // データを取得
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('podcast_episodes')
                .select('*')
                .eq('user_id', userId)
                .eq('soft_deleted', false)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            return {
                episodes: data.map((item) => new PodcastEpisodeEntity(item)),
                total: count || 0,
            };
        } catch (error) {
            this.logger.error(`Failed to find podcast episodes: ${error.message}`);
            return { episodes: [], total: 0 };
        }
    }

    // エピソードをIDで取得（ユーザー分離）
    async findById(id: number, userId: string): Promise<PodcastEpisodeEntity | null> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('podcast_episodes')
                .select('*')
                .eq('id', id)
                .eq('user_id', userId) // ユーザー分離の保証
                .eq('soft_deleted', false)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }

            return new PodcastEpisodeEntity(data);
        } catch (error) {
            this.logger.error(`Failed to find podcast episode by ID: ${error.message}`);
            return null;
        }
    }

    // 音声URLを更新（Cloudflare R2アップロード後）
    updateAudioUrl(id: number, userId: string, audioUrl: string): Promise<PodcastEpisodeEntity> {
        return this.update(id, userId, { audio_url: audioUrl });
    }

    // タイトルと埋め込みベクトルを更新
    updateTitleAndEmbedding(
        id: number,
        userId: string,
        title: string,
        titleEmb?: number[],
    ): Promise<PodcastEpisodeEntity> {
        return this.update(id, userId, {
            title,
            title_embedding: titleEmb || null,
        });
    }

    // ソフト削除
    async softDelete(id: number, userId: string): Promise<void> {
        try {
            const { error } = await this.supabaseRequestService
                .getClient()
                .from('podcast_episodes')
                .update({
                    soft_deleted: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('user_id', userId); // ユーザー分離の保証

            if (error) throw error;
        } catch (error) {
            this.logger.error(`Failed to soft delete podcast episode: ${error.message}`);
            throw error;
        }
    }

    // 古いエピソードの取得（クリーンアップ用）
    async findOldEpisodes(userId: string, daysOld: number): Promise<PodcastEpisodeEntity[]> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('podcast_episodes')
                .select('*')
                .eq('user_id', userId)
                .eq('soft_deleted', false)
                .lt('created_at', cutoffDate.toISOString());

            if (error) throw error;
            return data.map((item) => new PodcastEpisodeEntity(item));
        } catch (error) {
            this.logger.error(`Failed to find old podcast episodes: ${error.message}`);
            return [];
        }
    }
}
