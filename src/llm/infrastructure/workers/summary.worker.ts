import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { EmbeddingQueueService } from "src/embedding/queue/embedding-queue.service";
import { DistributedLockService } from "src/shared/lock/distributed-lock.service";
import {
    GeminiSummaryRequest,
    LLM_SERVICE,
    LlmService,
} from "../../application/services/llm.service";
import { SCRIPT_GENERATE_QUEUE } from "../../application/services/summary-script.service";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

export interface SummaryJobData {
    userId: string;
    summaryDate?: string;
}

@Processor("summary-generate")
@Injectable()
export class SummaryWorker extends WorkerHost {
    private readonly logger = new Logger(SummaryWorker.name);

    constructor(
        private readonly dailySummaryRepository: DailySummaryRepository,
        @Inject(LLM_SERVICE) private readonly llmService: LlmService,
        @InjectQueue(SCRIPT_GENERATE_QUEUE)
        private readonly scriptQueue: Queue,
        private readonly embeddingQueueService: EmbeddingQueueService,
        private readonly lock: DistributedLockService,
    ) {
        super();
    }

    async process(job: Job<SummaryJobData>) {
        const { userId } = job.data;
        const summaryDate =
            job.data.summaryDate || this.formatDateJst(new Date());
        this.logger.log(
            `Processing summary job for user ${userId}, date ${summaryDate}`,
        );

        let lockId: string | null = null;
        try {
            // ユーザー単位の直列化ロック（5分）
            lockId = await this.lock.acquire(`summary:${userId}`, 5 * 60_000);
            if (!lockId) {
                this.logger.warn(
                    `Another summary job is running for user ${userId}, skipping`,
                );
                return { success: true, skipped: true } as const;
            }
            const start = Date.now();
            // 既存の要約をチェック
            const existingSummary =
                await this.dailySummaryRepository.findByUserAndDate(
                    userId,
                    summaryDate,
                );
            if (existingSummary?.isCompleteSummary()) {
                this.logger.log(
                    `Summary already exists for user ${userId}, date ${summaryDate}`,
                );
                return { success: true, summaryId: existingSummary.id };
            }

            // 最新24時間のフィードアイテムを取得
            const feedItems =
                await this.dailySummaryRepository.getRecentFeedItems(
                    userId,
                    24,
                );

            if (feedItems.length === 0) {
                this.logger.log(`No feed items found for user ${userId}`);
                return { success: false, reason: "No feed items found" };
            }

            // LLM用のリクエストデータを準備
            const summaryRequest: GeminiSummaryRequest = {
                articles: feedItems.map((item) => ({
                    title: item.title,
                    content: item.description || "",
                    url: item.link,
                    publishedAt: item.published_at || new Date().toISOString(),
                    language: this.detectLanguage(
                        item.title,
                        item.description || "",
                    ),
                })),
                targetLanguage: this.determineTargetLanguage(feedItems),
            };

            // LLMで要約生成
            const summaryResponse =
                await this.llmService.generateSummary(summaryRequest);

            // 要約をデータベースに保存
            let summary = existingSummary;
            if (summary) {
                summary = await this.dailySummaryRepository.update(
                    summary.id,
                    userId,
                    {
                        markdown: summaryResponse.content,
                        summary_title: this.extractTitleFromMarkdown(
                            summaryResponse.content,
                        ),
                    },
                );
            } else {
                summary = await this.dailySummaryRepository.create(
                    userId,
                    summaryDate,
                    {
                        markdown: summaryResponse.content,
                        summary_title: this.extractTitleFromMarkdown(
                            summaryResponse.content,
                        ),
                    },
                );
            }

            // フィードアイテムとの関連を保存
            const feedItemIds = feedItems.map((item) => item.id);
            await this.dailySummaryRepository.addSummaryItems(
                summary.id,
                userId,
                feedItemIds,
            );

            this.logger.log(
                `Summary generated successfully for user ${userId}, summary ID: ${summary.id}`,
            );

            // 生成直後に埋め込み更新ジョブを追加（単発）
            await this.embeddingQueueService.addSingleEmbeddingJob(
                userId,
                summary.id,
                "daily_summaries",
            );

            // 台本生成ジョブをキューに連鎖投入
            await this.scriptQueue.add(
                "generateSummaryScript",
                {
                    userId,
                    summaryId: summary.id,
                },
                {
                    removeOnComplete: true,
                    removeOnFail: 5,
                    attempts: 3,
                    backoff: { type: "fixed", delay: 30_000 },
                    jobId: `script:${summary.id}`,
                },
            );

            const durationMs = Date.now() - start;
            this.logger.log(
                `Summary job completed for user ${userId} in ${durationMs}ms`,
            );
            return { success: true, summaryId: summary.id };
        } catch (error) {
            this.logger.error(
                `Failed to process summary job: ${error.message}`,
                error.stack,
            );
            throw error;
        } finally {
            // ロック解放
            try {
                if (lockId) {
                    await this.lock.release(`summary:${userId}`, lockId);
                }
            } catch {
                // ロックIDを保持していないので個別解放はしない（acquire成功時のみ解放）
            }
        }
    }

    private detectLanguage(title: string, description = ""): string {
        const text = `${title} ${description}`.toLowerCase();
        // 簡単な日本語検出（ひらがな、カタカナ、漢字）
        const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
        return japaneseRegex.test(text) ? "ja" : "en";
    }

    private determineTargetLanguage(
        feedItems: {
            title: string;
            description: string | null;
        }[],
    ): "ja" | "en" {
        const japaneseCount = feedItems.filter(
            (item) =>
                this.detectLanguage(item.title, item.description || "") ===
                "ja",
        ).length;

        // 日本語記事が半数以上なら日本語、そうでなければ英語
        return japaneseCount >= feedItems.length / 2 ? "ja" : "en";
    }

    private extractTitleFromMarkdown(markdown: string): string {
        // マークダウンから最初のH1またはH2タイトルを抽出
        const titleMatch = markdown.match(/^#{1,2}\s+(.+)$/m);
        if (titleMatch) {
            return titleMatch[1].trim();
        }

        // タイトルが見つからない場合は最初の50文字を使用
        const plainText = markdown.replace(/[#*_`]/g, "").trim();
        return (
            plainText.substring(0, 50) + (plainText.length > 50 ? "..." : "")
        );
    }

    // JST(UTC+9)基準でYYYY-MM-DDを返す
    private formatDateJst(date: Date): string {
        const utc = date.getTime() + date.getTimezoneOffset() * 60000;
        const jst = new Date(utc + 9 * 60 * 60000);
        const yyyy = jst.getFullYear();
        const mm = String(jst.getMonth() + 1).padStart(2, "0");
        const dd = String(jst.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }
}
