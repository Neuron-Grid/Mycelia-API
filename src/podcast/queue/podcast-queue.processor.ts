import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { validateDto } from "@/common/utils/validation";
import { WorkerDailySummaryRepository } from "@/llm/infrastructure/repositories/worker-daily-summary.repository";
import { WorkerPodcastEpisodeRepository } from "@/podcast/infrastructure/worker-podcast-episode.repository";
import { DistributedLockService } from "@/shared/lock/distributed-lock.service";
import { WorkerUserSettingsRepository } from "@/shared/settings/worker-user-settings.repository";
import { EmbeddingService } from "../../search/infrastructure/services/embedding.service";
import { CloudflareR2Service, PodcastMetadata } from "../cloudflare-r2.service";
import { PodcastTtsService } from "../podcast-tts.service";
import { GeneratePodcastForTodayJobDto } from "./dto/generate-today-job.dto";
import {
    AudioEnhancementJobDto,
    PodcastCleanupJobDto,
    PodcastGenerationJobDto,
} from "./dto/podcast-generation-job.dto";

@Processor("podcastQueue")
@Injectable()
export class PodcastQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(PodcastQueueProcessor.name);

    constructor(
        private readonly dailySummaryRepository: WorkerDailySummaryRepository,
        private readonly podcastEpisodeRepository: WorkerPodcastEpisodeRepository,
        private readonly podcastTtsService: PodcastTtsService,
        private readonly cloudflareR2Service: CloudflareR2Service,
        private readonly embeddingService: EmbeddingService,
        @InjectQueue("podcastQueue") private readonly podcastQueue: Queue,
        // 設定からTTS言語を取得
        private readonly settingsRepo: WorkerUserSettingsRepository,
        private readonly lock: DistributedLockService,
    ) {
        super();
    }

    async process(
        job: Job<
            | PodcastGenerationJobDto
            | AudioEnhancementJobDto
            | PodcastCleanupJobDto
        >,
    ) {
        switch (job.name) {
            case "generatePodcast":
                return await this.processPodcastGeneration(
                    job as Job<PodcastGenerationJobDto>,
                );
            case "enhanceAudio":
                return await this.processAudioEnhancement(
                    job as Job<AudioEnhancementJobDto>,
                );
            case "cleanupOldPodcasts":
                return await this.processOldPodcastCleanup(
                    job as Job<PodcastCleanupJobDto>,
                );
            case "generatePodcastForToday":
                return await this.processPodcastForToday(
                    job as Job<GeneratePodcastForTodayJobDto>,
                );
            default:
                this.logger.warn(`Unknown job: ${job.name}`);
                return { success: false };
        }
    }

    // 当日の要約があれば、その要約IDでgeneratePodcastジョブを再投入
    async processPodcastForToday(job: Job<GeneratePodcastForTodayJobDto>) {
        await validateDto(GeneratePodcastForTodayJobDto, job.data);
        const { userId } = job.data;
        const today = this.formatDateJst(new Date());
        this.logger.log(
            `Processing generatePodcastForToday for user ${userId}, date ${today}`,
        );

        const summary = await this.dailySummaryRepository.findByUserAndDate(
            userId,
            today,
        );
        if (!summary) {
            this.logger.log(
                `No summary found for user ${userId} on ${today}, skipping podcast generation`,
            );
            return { success: true, skipped: true } as const;
        }

        await this.podcastQueue.add(
            "generatePodcast",
            { userId, summaryId: summary.id } as PodcastGenerationJobDto,
            {
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 3,
                backoff: { type: "fixed", delay: 30_000 },
                jobId: `podcast:${userId}:${summary.id}`,
            },
        );

        this.logger.log(
            `Enqueued generatePodcast for user ${userId}, summary ${summary.id}`,
        );
        return { success: true, enqueued: true } as const;
    }

    async processPodcastGeneration(job: Job<PodcastGenerationJobDto>) {
        // DTO バリデーション – 破損データを早期検出
        await validateDto(PodcastGenerationJobDto, job.data);
        const { userId, summaryId } = job.data;
        this.logger.log(
            `Processing podcast generation for user ${userId}, summary ${summaryId}`,
        );

        let lockId: string | null = null;
        try {
            // 直列化ロック（ユーザー単位、10分）
            lockId = await this.lock.acquire(`podcast:${userId}`, 10 * 60_000);
            if (!lockId) {
                this.logger.warn(
                    `Another podcast job is running for user ${userId}, skipping`,
                );
                return { success: true, skipped: true } as const;
            }
            const start = Date.now();
            // 既存のエピソードをチェック
            const existingEpisode =
                await this.podcastEpisodeRepository.findBySummaryId(
                    userId,
                    summaryId,
                );
            if (existingEpisode?.isComplete()) {
                this.logger.log(
                    `Podcast episode already exists for summary ${summaryId}`,
                );
                return {
                    success: true,
                    episodeId: existingEpisode.id,
                    existed: true,
                };
            }

            // 要約を取得（ID 指定で取得）
            const summary = await this.dailySummaryRepository.findById(
                summaryId,
                userId,
            );

            if (!summary) {
                throw new Error(
                    `Summary not found for user ${userId}, summary ID: ${summaryId}`,
                );
            }

            if (!summary.hasScript()) {
                throw new Error(
                    `Summary ${summaryId} does not have a script for TTS generation`,
                );
            }

            // ポッドキャストエピソードを作成または取得
            let episode = existingEpisode;
            if (!episode) {
                // エピソードタイトルを生成
                const episodeTitle = this.generateEpisodeTitle(
                    summary.summary_title,
                    summary.summary_date,
                );

                // タイトルのベクトル埋め込みを生成
                let titleEmbedding: number[] | undefined;
                try {
                    titleEmbedding =
                        await this.embeddingService.generateEmbedding(
                            this.embeddingService.preprocessText(episodeTitle),
                        );
                } catch (error) {
                    this.logger.warn(
                        `Failed to generate title embedding: ${error.message}`,
                    );
                }

                episode = await this.podcastEpisodeRepository.upsert(
                    userId,
                    summaryId,
                    episodeTitle,
                    titleEmbedding,
                );
            }

            // 生成に失敗している（あるいは既存取得に失敗している）場合は即座に中断
            if (!episode) {
                throw new Error(
                    `Failed to initialize podcast episode for summary ${summaryId}`,
                );
            }

            // 音声ファイルが既に存在する場合はスキップ
            if (episode.hasAudio()) {
                this.logger.log(
                    `Audio already exists for episode ${episode.id}`,
                );
                return {
                    success: true,
                    episodeId: episode.id,
                    audioUrl: episode.audio_url,
                };
            }

            // script_textの存在チェック
            if (!summary.script_text) {
                throw new Error(
                    "Script text is required for podcast generation",
                );
            }

            // TTS音声生成
            this.logger.log(
                `Generating TTS audio for script length: ${summary.script_text.length} characters`,
            );
            // ユーザー設定から言語を取得（デフォルトはja-JP）
            const settings = await this.settingsRepo.getByUserId(userId);
            const language: "ja-JP" | "en-US" =
                settings?.podcast_language === "en-US" ? "en-US" : "ja-JP";
            const audioBuffer = await this.podcastTtsService.generateSpeech(
                summary.script_text,
                language,
            );

            // 音声の長さを推定（概算）
            const estimatedDurationSec = Math.ceil(
                summary.script_text.length / 10,
            ); // 1秒あたり約10文字

            // Cloudflare R2にアップロード
            const podcastMetadata: PodcastMetadata = {
                userId,
                summaryId,
                episodeId: episode.id,
                title: episode.title || "Untitled Episode",
                duration: estimatedDurationSec,
                language,
                generatedAt: new Date().toISOString(),
            };

            const audioUrl = await this.cloudflareR2Service.uploadPodcastAudio(
                userId,
                audioBuffer,
                podcastMetadata,
            );

            // エピソード情報を更新
            const updatedEpisode =
                await this.podcastEpisodeRepository.updateAudioUrl(
                    episode.id,
                    userId,
                    audioUrl,
                    estimatedDurationSec,
                );

            // 要約にTTS音声の長さを記録
            await this.dailySummaryRepository.update(summaryId, userId, {
                script_tts_duration_sec: estimatedDurationSec,
            });

            const durationMs = Date.now() - start;
            this.logger.log(
                `Podcast generation completed successfully for episode ${episode.id} in ${durationMs}ms`,
            );
            return {
                success: true,
                episodeId: updatedEpisode.id,
                audioUrl: updatedEpisode.audio_url,
                duration: estimatedDurationSec,
                title: updatedEpisode.title,
            };
        } catch (error) {
            this.logger.error(
                `Failed to process podcast generation: ${error.message}`,
                error.stack,
            );
            throw error;
        } finally {
            // ロック解放
            try {
                if (lockId) {
                    await this.lock.release(`podcast:${userId}`, lockId);
                }
            } catch {
                // lock release failure is non-fatal; lock will expire
            }
        }
    }

    // 音声品質向上処理（オプション）
    async processAudioEnhancement(job: Job<AudioEnhancementJobDto>) {
        // DTO バリデーション – 破損データを早期検出
        await validateDto(AudioEnhancementJobDto, job.data);
        const { episodeId, userId } = job.data;
        this.logger.log(
            `Processing audio enhancement for episode ${episodeId}`,
        );

        try {
            const episode = await this.podcastEpisodeRepository.findById(
                episodeId,
                userId,
            );
            if (!episode || !episode.hasAudio()) {
                throw new Error("Episode or audio not found");
            }

            // TODO: 音声品質向上処理の実装
            // - ノイズ除去
            // - 音量正規化
            // - 音声圧縮最適化

            this.logger.log(
                `Audio enhancement completed for episode ${episodeId}`,
            );
            return { success: true, episodeId };
        } catch (error) {
            this.logger.error(
                `Failed to enhance audio: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    // 古いポッドキャストファイルの削除処理
    async processOldPodcastCleanup(job: Job<PodcastCleanupJobDto>) {
        // DTO バリデーション – 破損データを早期検出
        await validateDto(PodcastCleanupJobDto, job.data);
        const { userId, daysOld } = job.data;
        this.logger.log(
            `Cleaning up podcasts older than ${daysOld} days for user ${userId}`,
        );

        try {
            const oldEpisodes =
                await this.podcastEpisodeRepository.findOldEpisodes(
                    userId,
                    daysOld,
                );

            for (const episode of oldEpisodes) {
                if (episode.audio_url) {
                    // R2からファイルを削除
                    const key = this.cloudflareR2Service.extractKeyFromUrl(
                        episode.audio_url,
                    );
                    if (
                        key &&
                        this.cloudflareR2Service.isUserFile(key, userId)
                    ) {
                        await this.cloudflareR2Service.deleteObject(key);
                    }
                }

                // エピソードをソフト削除
                await this.podcastEpisodeRepository.softDelete(
                    episode.id,
                    userId,
                );
            }

            this.logger.log(
                `Cleaned up ${oldEpisodes.length} old podcast episodes for user ${userId}`,
            );
            return { success: true, cleanedCount: oldEpisodes.length };
        } catch (error) {
            this.logger.error(
                `Failed to cleanup old podcasts: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    // プライベートメソッド: エピソードタイトル生成
    private generateEpisodeTitle(
        summaryTitle: string | null,
        summaryDate: string,
    ): string {
        const date = new Date(summaryDate);
        const formattedDate = date.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        if (summaryTitle) {
            return `${formattedDate} - ${summaryTitle}`;
        }

        return `${formattedDate}のニュース要約`;
    }

    private formatDateJst(date: Date): string {
        const utc = date.getTime() + date.getTimezoneOffset() * 60000;
        const jst = new Date(utc + 9 * 60 * 60000);
        const yyyy = jst.getFullYear();
        const mm = String(jst.getMonth() + 1).padStart(2, "0");
        const dd = String(jst.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }
}
