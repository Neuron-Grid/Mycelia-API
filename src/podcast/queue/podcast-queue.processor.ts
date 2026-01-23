import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { buildPodcastJobId } from "@/common/utils/job-id.util";
import { validateDto } from "@/common/utils/validation";
import { WorkerDailySummaryRepository } from "@/llm/infrastructure/repositories/worker-daily-summary.repository";
import { WorkerPodcastEpisodeRepository } from "@/podcast/infrastructure/worker-podcast-episode.repository";
import { DistributedLockService } from "@/shared/lock/distributed-lock.service";
import { WorkerUserSettingsRepository } from "@/shared/settings/worker-user-settings.repository";
import { JstDateService } from "@/shared/time/jst-date.service";
import { EmbeddingService } from "../../search/infrastructure/services/embedding.service";
import { CloudflareR2Service, PodcastMetadata } from "../cloudflare-r2.service";
import {
    PodcastTtsService,
    SpeechSynthesisOptions,
} from "../podcast-tts.service";
import { GeneratePodcastForTodayJobDto } from "./dto/generate-today-job.dto";
import {
    AudioEnhancementJobDto,
    PodcastCleanupJobDto,
    PodcastGenerationJobDto,
} from "./dto/podcast-generation-job.dto";

type SkipResult = { success: true; skipped: true };

type PodcastGenerationResult =
    | SkipResult
    | {
          success: true;
          episodeId: number;
          existed?: true;
          audioUrl?: string;
          duration?: number;
          title?: string;
      };

type PodcastEnhancementResult =
    | SkipResult
    | {
          success: true;
          episodeId: number;
          audioUrl: string;
          duration: number;
      };

const SKIP_RESULT: SkipResult = { success: true, skipped: true };

@Processor("podcastQueue")
@Injectable()
export class PodcastQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(PodcastQueueProcessor.name);
    private static readonly GENERATION_LOCK_TTL_MS = 10 * 60_000;
    private static readonly ENHANCEMENT_LOCK_TTL_MS = 5 * 60_000;

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
        private readonly time: JstDateService,
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
        const today = this.time.formatDate(new Date());
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
                jobId: buildPodcastJobId(userId, summary.id),
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

        return await this.withUserLock<PodcastGenerationResult>(
            userId,
            PodcastQueueProcessor.GENERATION_LOCK_TTL_MS,
            async () => {
                const start = Date.now();
                try {
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

                    let episode = existingEpisode;
                    if (!episode) {
                        const episodeTitle = this.generateEpisodeTitle(
                            summary.summary_title,
                            summary.summary_date,
                        );

                        let titleEmbedding: number[] | undefined;
                        try {
                            titleEmbedding =
                                await this.embeddingService.generateEmbedding(
                                    this.embeddingService.preprocessText(
                                        episodeTitle,
                                    ),
                                );
                        } catch (error) {
                            this.logger.warn(
                                `Failed to generate title embedding: ${this.getErrorMessage(error)}`,
                            );
                        }

                        episode = await this.podcastEpisodeRepository.upsert(
                            userId,
                            summaryId,
                            episodeTitle,
                            titleEmbedding,
                        );
                    }

                    if (!episode) {
                        throw new Error(
                            `Failed to initialize podcast episode for summary ${summaryId}`,
                        );
                    }

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

                    if (!summary.script_text) {
                        throw new Error(
                            "Script text is required for podcast generation",
                        );
                    }

                    this.logger.log(
                        `Generating TTS audio for script length: ${summary.script_text.length} characters`,
                    );
                    const language = await this.getPodcastLanguage(userId);
                    const audioBuffer =
                        await this.podcastTtsService.generateSpeech(
                            summary.script_text,
                            language,
                        );

                    const estimatedDurationSec =
                        this.estimateDurationFromScript(summary.script_text);

                    const podcastMetadata = this.buildPodcastMetadata({
                        userId,
                        summaryId,
                        episodeId: episode.id,
                        title: episode.title || "Untitled Episode",
                        duration: estimatedDurationSec,
                        language,
                    });

                    const audioUrl =
                        await this.cloudflareR2Service.uploadPodcastAudio(
                            userId,
                            audioBuffer,
                            podcastMetadata,
                        );

                    const updatedEpisode =
                        await this.podcastEpisodeRepository.updateAudioUrl(
                            episode.id,
                            userId,
                            audioUrl,
                            estimatedDurationSec,
                        );

                    await this.dailySummaryRepository.update(
                        summaryId,
                        userId,
                        {
                            script_tts_duration_sec: estimatedDurationSec,
                        },
                    );

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
                        `Failed to process podcast generation: ${this.getErrorMessage(error)}`,
                        this.getErrorStack(error),
                    );
                    throw error;
                }
            },
            () => {
                this.logger.warn(
                    `Another podcast job is running for user ${userId}, skipping`,
                );
                return SKIP_RESULT;
            },
        );
    }

    // 音声品質向上処理（オプション）
    async processAudioEnhancement(job: Job<AudioEnhancementJobDto>) {
        await validateDto(AudioEnhancementJobDto, job.data);
        const { episodeId, userId } = job.data;
        this.logger.log(
            `Processing audio enhancement for episode ${episodeId}`,
        );

        return await this.withUserLock<PodcastEnhancementResult>(
            userId,
            PodcastQueueProcessor.ENHANCEMENT_LOCK_TTL_MS,
            async () => {
                try {
                    const episode =
                        await this.podcastEpisodeRepository.findById(
                            episodeId,
                            userId,
                        );
                    if (!episode || !episode.hasAudio()) {
                        throw new Error("Episode or audio not found");
                    }

                    const summary = await this.dailySummaryRepository.findById(
                        episode.summary_id,
                        userId,
                    );
                    if (!summary) {
                        throw new Error(
                            `Summary not found for user ${userId}, summary ID: ${episode.summary_id}`,
                        );
                    }
                    if (!summary.hasScript()) {
                        throw new Error(
                            `Summary ${summary.id} does not contain a script for regeneration`,
                        );
                    }

                    const language = await this.getPodcastLanguage(userId);

                    const scriptText = summary.script_text ?? "";
                    if (!scriptText) {
                        throw new Error(
                            `Summary ${summary.id} does not contain script text`,
                        );
                    }

                    const synthesisOptions =
                        this.buildEnhancementOptions(language);
                    const enhancedAudio =
                        await this.podcastTtsService.generateSpeech(
                            scriptText,
                            language,
                            synthesisOptions,
                        );

                    const estimatedDurationSec =
                        this.estimateDurationFromScript(scriptText);

                    const podcastMetadata = this.buildPodcastMetadata({
                        userId,
                        summaryId: summary.id,
                        episodeId: episode.id,
                        title:
                            episode.title ||
                            summary.summary_title ||
                            "Untitled Episode",
                        duration: estimatedDurationSec,
                        language,
                    });

                    const previousAudioUrl = episode.audio_url;
                    const enhancedAudioUrl =
                        await this.cloudflareR2Service.uploadPodcastAudio(
                            userId,
                            enhancedAudio,
                            podcastMetadata,
                        );

                    const updatedEpisode =
                        await this.podcastEpisodeRepository.updateAudioUrl(
                            episode.id,
                            userId,
                            enhancedAudioUrl,
                            estimatedDurationSec,
                        );

                    await this.dailySummaryRepository.update(
                        summary.id,
                        userId,
                        {
                            script_tts_duration_sec: estimatedDurationSec,
                        },
                    );

                    await this.removePreviousAudio(previousAudioUrl, userId);

                    this.logger.log(
                        `Audio enhancement completed for episode ${episodeId}`,
                    );
                    return {
                        success: true,
                        episodeId: updatedEpisode.id,
                        audioUrl: updatedEpisode.audio_url,
                        duration: estimatedDurationSec,
                    } as const;
                } catch (error) {
                    this.logger.error(
                        `Failed to enhance audio: ${this.getErrorMessage(error)}`,
                        this.getErrorStack(error),
                    );
                    throw error;
                }
            },
            () => {
                this.logger.warn(
                    `Skipped audio enhancement because another job is running for user ${userId}`,
                );
                return SKIP_RESULT;
            },
        );
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
                    const location =
                        this.cloudflareR2Service.extractObjectLocationFromUrl(
                            episode.audio_url,
                        );
                    const key = location.key;
                    const bucket = location.bucket ?? undefined;
                    if (
                        key &&
                        this.cloudflareR2Service.isUserFile(key, userId, bucket)
                    ) {
                        if (bucket) {
                            await this.cloudflareR2Service.deleteObject(
                                key,
                                bucket,
                            );
                        } else {
                            await this.cloudflareR2Service.deleteObject(key);
                        }
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
                `Failed to cleanup old podcasts: ${this.getErrorMessage(error)}`,
                this.getErrorStack(error),
            );
            throw error;
        }
    }

    private estimateDurationFromScript(script: string): number {
        const averageCharsPerSecond = 10;
        const estimate = Math.ceil(script.length / averageCharsPerSecond);
        return Math.max(1, estimate);
    }

    private buildEnhancementOptions(
        language: "ja-JP" | "en-US",
    ): SpeechSynthesisOptions {
        const base: SpeechSynthesisOptions = {
            sampleRateHertz: 48_000,
            effectsProfileIds: ["large-home-entertainment-class-device"],
        };

        if (language === "ja-JP") {
            return { ...base, speakingRate: 0.95, pitch: -1.0 };
        }

        return { ...base, speakingRate: 1.0, pitch: -0.5 };
    }

    private async removePreviousAudio(
        previousAudioUrl: string | null,
        userId: string,
    ): Promise<void> {
        if (!previousAudioUrl) return;
        const location =
            this.cloudflareR2Service.extractObjectLocationFromUrl(
                previousAudioUrl,
            );
        const key = location.key ?? undefined;
        const bucket = location.bucket ?? undefined;
        if (!key) return;
        if (!this.cloudflareR2Service.isUserFile(key, userId, bucket)) return;

        try {
            if (bucket) {
                await this.cloudflareR2Service.deleteObject(key, bucket);
            } else {
                await this.cloudflareR2Service.deleteObject(key);
            }
        } catch (error) {
            this.logger.warn(
                `Failed to delete previous audio for user ${userId}: ${this.getErrorMessage(error)}`,
            );
        }
    }

    private async withUserLock<T>(
        userId: string,
        ttlMs: number,
        action: () => Promise<T>,
        onSkip: () => T,
    ): Promise<T> {
        const lockKey = `podcast:${userId}`;
        const lockId = await this.lock.acquire(lockKey, ttlMs);
        if (!lockId) {
            return onSkip();
        }

        try {
            return await action();
        } finally {
            try {
                await this.lock.release(lockKey, lockId);
            } catch {
                // lock release failure is non-fatal; lock will expire
            }
        }
    }

    private async getPodcastLanguage(
        userId: string,
    ): Promise<"ja-JP" | "en-US"> {
        const settings = await this.settingsRepo.getByUserId(userId);
        return settings?.podcast_language === "en-US" ? "en-US" : "ja-JP";
    }

    private buildPodcastMetadata(args: {
        userId: string;
        summaryId: number;
        episodeId?: number;
        title: string;
        duration: number;
        language: "ja-JP" | "en-US";
    }): PodcastMetadata {
        return {
            userId: args.userId,
            summaryId: args.summaryId,
            episodeId: args.episodeId,
            title: args.title,
            duration: args.duration,
            language: args.language,
            generatedAt: new Date().toISOString(),
        };
    }

    private getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    private getErrorStack(error: unknown): string | undefined {
        return error instanceof Error ? error.stack : undefined;
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
}
