import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { DailySummaryRepository } from '../../llm/infrastructure/daily-summary.repository'
import { EmbeddingService } from '../../search/embedding.service'
import { CloudflareR2Service, PodcastMetadata } from '../cloudflare-r2.service'
import { PodcastEpisodeRepository } from '../infrastructure/podcast-episode.repository'
import { PodcastTtsService } from '../podcast-tts.service'

export interface PodcastGenerationJobData {
    userId: string
    summaryId: number
}

@Processor('podcastQueue')
@Injectable()
export class PodcastQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(PodcastQueueProcessor.name)

    constructor(
        private readonly dailySummaryRepository: DailySummaryRepository,
        private readonly podcastEpisodeRepository: PodcastEpisodeRepository,
        private readonly podcastTtsService: PodcastTtsService,
        private readonly cloudflareR2Service: CloudflareR2Service,
        private readonly embeddingService: EmbeddingService,
    ) {
        super()
    }

    @Processor('generatePodcast')
    async processPodcastGeneration(job: Job<PodcastGenerationJobData>) {
        const { userId, summaryId } = job.data
        this.logger.log(`Processing podcast generation for user ${userId}, summary ${summaryId}`)

        try {
            // 既存のエピソードをチェック
            const existingEpisode = await this.podcastEpisodeRepository.findBySummaryId(
                userId,
                summaryId,
            )
            if (existingEpisode?.isComplete()) {
                this.logger.log(`Podcast episode already exists for summary ${summaryId}`)
                return { success: true, episodeId: existingEpisode.id, existed: true }
            }

            // 要約を取得
            const summaries = await this.dailySummaryRepository.findByUser(userId, 100, 0)
            const summary = summaries.find((s) => s.id === summaryId)

            if (!summary) {
                throw new Error(`Summary not found for user ${userId}, summary ID: ${summaryId}`)
            }

            if (!summary.hasScript()) {
                throw new Error(`Summary ${summaryId} does not have a script for TTS generation`)
            }

            // ポッドキャストエピソードを作成または取得
            let episode = existingEpisode
            if (!episode) {
                // エピソードタイトルを生成
                const episodeTitle = this.generateEpisodeTitle(
                    summary.summary_title,
                    summary.summary_date,
                )

                // タイトルのベクトル埋め込みを生成
                let titleEmbedding: number[] | undefined
                try {
                    titleEmbedding = await this.embeddingService.generateEmbedding(
                        this.embeddingService.preprocessText(episodeTitle),
                    )
                } catch (error) {
                    this.logger.warn(`Failed to generate title embedding: ${error.message}`)
                }

                episode = await this.podcastEpisodeRepository.create(userId, summaryId, {
                    title: episodeTitle,
                    title_embedding: titleEmbedding,
                })
            }

            // 音声ファイルが既に存在する場合はスキップ
            if (episode.hasAudio()) {
                this.logger.log(`Audio already exists for episode ${episode.id}`)
                return { success: true, episodeId: episode.id, audioUrl: episode.audio_url }
            }

            // script_textの存在チェック
            if (!summary.script_text) {
                throw new Error('Script text is required for podcast generation')
            }

            // TTS音声生成
            this.logger.log(
                `Generating TTS audio for script length: ${summary.script_text.length} characters`,
            )
            const audioBuffer = await this.podcastTtsService.generateSpeech(
                summary.script_text,
                'ja-JP', // TODO: ユーザー設定から取得
                'ja-JP-Wavenet-B', // 男性ニュースキャスターらしい声
            )

            // 音声の長さを推定（概算）
            const estimatedDurationSec = Math.ceil(summary.script_text.length / 10) // 1秒あたり約10文字

            // Cloudflare R2にアップロード
            const podcastMetadata: PodcastMetadata = {
                userId,
                summaryId,
                episodeId: episode.id,
                title: episode.title || 'Untitled Episode',
                duration: estimatedDurationSec,
                language: 'ja-JP',
                generatedAt: new Date().toISOString(),
            }

            const audioUrl = await this.cloudflareR2Service.uploadPodcastAudio(
                userId,
                audioBuffer,
                podcastMetadata,
            )

            // エピソード情報を更新
            const updatedEpisode = await this.podcastEpisodeRepository.updateAudioUrl(
                episode.id,
                userId,
                audioUrl,
            )

            // 要約にTTS音声の長さを記録
            await this.dailySummaryRepository.update(summaryId, userId, {
                script_tts_duration_sec: estimatedDurationSec,
            })

            this.logger.log(`Podcast generation completed successfully for episode ${episode.id}`)
            return {
                success: true,
                episodeId: updatedEpisode.id,
                audioUrl: updatedEpisode.audio_url,
                duration: estimatedDurationSec,
                title: updatedEpisode.title,
            }
        } catch (error) {
            this.logger.error(`Failed to process podcast generation: ${error.message}`, error.stack)
            throw error
        }
    }

    // 音声品質向上処理（オプション）
    @Processor('enhanceAudio')
    async processAudioEnhancement(job: Job<{ episodeId: number; userId: string }>) {
        const { episodeId, userId } = job.data
        this.logger.log(`Processing audio enhancement for episode ${episodeId}`)

        try {
            const episode = await this.podcastEpisodeRepository.findById(episodeId, userId)
            if (!episode || !episode.hasAudio()) {
                throw new Error('Episode or audio not found')
            }

            // TODO: 音声品質向上処理の実装
            // - ノイズ除去
            // - 音量正規化
            // - 音声圧縮最適化

            this.logger.log(`Audio enhancement completed for episode ${episodeId}`)
            return { success: true, episodeId }
        } catch (error) {
            this.logger.error(`Failed to enhance audio: ${error.message}`, error.stack)
            throw error
        }
    }

    // 古いポッドキャストファイルの削除処理
    @Processor('cleanupOldPodcasts')
    async processOldPodcastCleanup(job: Job<{ userId: string; daysOld: number }>) {
        const { userId, daysOld } = job.data
        this.logger.log(`Cleaning up podcasts older than ${daysOld} days for user ${userId}`)

        try {
            const oldEpisodes = await this.podcastEpisodeRepository.findOldEpisodes(userId, daysOld)

            for (const episode of oldEpisodes) {
                if (episode.audio_url) {
                    // R2からファイルを削除
                    const key = this.cloudflareR2Service.extractKeyFromUrl(episode.audio_url)
                    if (key && this.cloudflareR2Service.isUserFile(key, userId)) {
                        await this.cloudflareR2Service.deleteFile('', key) // bucketは内部で処理
                    }
                }

                // エピソードをソフト削除
                await this.podcastEpisodeRepository.softDelete(episode.id, userId)
            }

            this.logger.log(
                `Cleaned up ${oldEpisodes.length} old podcast episodes for user ${userId}`,
            )
            return { success: true, cleanedCount: oldEpisodes.length }
        } catch (error) {
            this.logger.error(`Failed to cleanup old podcasts: ${error.message}`, error.stack)
            throw error
        }
    }

    // プライベートメソッド: エピソードタイトル生成
    private generateEpisodeTitle(summaryTitle: string | null, summaryDate: string): string {
        const date = new Date(summaryDate)
        const formattedDate = date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })

        if (summaryTitle) {
            return `${formattedDate} - ${summaryTitle}`
        }

        return `${formattedDate}のニュース要約`
    }
}
