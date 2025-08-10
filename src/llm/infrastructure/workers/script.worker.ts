import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { UserSettingsRepository } from "src/shared/settings/user-settings.repository";
import {
    GeminiScriptRequest,
    LLM_SERVICE,
    LlmService,
} from "../../application/services/llm.service";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

export interface ScriptJobData {
    userId: string;
    summaryId: number;
}

@Processor("script-generate")
@Injectable()
export class ScriptWorker extends WorkerHost {
    private readonly logger = new Logger(ScriptWorker.name);

    constructor(
        private readonly dailySummaryRepository: DailySummaryRepository,
        @Inject(LLM_SERVICE) private readonly llmService: LlmService,
        @InjectQueue("podcastQueue") private readonly podcastQueue: Queue,
        private readonly settingsRepo: UserSettingsRepository,
    ) {
        super();
    }

    async process(job: Job<ScriptJobData>) {
        const { userId, summaryId } = job.data;
        this.logger.log(
            `Processing script generation job for user ${userId}, summary ID: ${summaryId}`,
        );

        try {
            // 要約をID+ユーザーで取得（RLS/分離）
            const targetSummary = await this.dailySummaryRepository.findById(
                summaryId,
                userId,
            );

            if (!targetSummary) {
                throw new Error(
                    `Summary not found for user ${userId}, summary ID: ${summaryId}`,
                );
            }

            if (!targetSummary.isCompleteSummary()) {
                throw new Error(
                    `Summary is not complete for summary ID: ${summaryId}`,
                );
            }

            if (targetSummary.hasScript()) {
                this.logger.log(
                    `Script already exists for summary ID: ${summaryId}`,
                );
                return {
                    success: true,
                    summaryId,
                    hasExistingScript: true,
                };
            }

            // 関連するフィードアイテムを取得
            const summaryItems =
                await this.dailySummaryRepository.getSummaryItems(
                    summaryId,
                    userId,
                );

            // スクリプト生成用のリクエストデータを準備
            const scriptRequest: GeminiScriptRequest = {
                summaryText: targetSummary.markdown || "",
                articlesForContext: summaryItems.map((item) => ({
                    title: `Feed Item ${item.feed_item_id}`,
                    url: `#${item.feed_item_id}`,
                })),
            };

            // LLMでスクリプト生成
            const scriptResponse =
                await this.llmService.generateScript(scriptRequest);

            // スクリプトを要約に追加
            await this.dailySummaryRepository.update(summaryId, userId, {
                script_text: scriptResponse.script,
            });

            this.logger.log(
                `Script generated successfully for summary ID: ${summaryId}`,
            );
            // 設定が有効なら、ポッドキャスト生成を連鎖投入
            const settings = await this.settingsRepo.getByUserId(userId);
            if (settings?.podcast_enabled && settings?.summary_enabled) {
                await this.podcastQueue.add(
                    "generatePodcast",
                    { userId, summaryId },
                    {
                        removeOnComplete: true,
                        removeOnFail: 5,
                        attempts: 3,
                        backoff: { type: "fixed", delay: 30_000 },
                        jobId: `podcast:${userId}:${summaryId}`,
                    },
                );
                this.logger.log(
                    `Enqueued podcast generation for user ${userId}, summary ${summaryId}`,
                );
            }

            return {
                success: true,
                summaryId,
                scriptLength: scriptResponse.script.length,
                hasExistingScript: false,
            };
        } catch (error) {
            this.logger.error(
                `Failed to process script job: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }
}
