import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
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
export interface ScriptByDateJobData {
    userId: string;
    summaryDate: string; // YYYY-MM-DD (JST)
}

@Processor("script-generate")
@Injectable()
export class ScriptWorker extends WorkerHost {
    private readonly logger = new Logger(ScriptWorker.name);

    constructor(
        private readonly dailySummaryRepository: DailySummaryRepository,
        @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    ) {
        super();
    }

    async process(job: Job<ScriptJobData | ScriptByDateJobData>) {
        if (job.name === "generateScriptForDate") {
            return await this.processByDate(job as Job<ScriptByDateJobData>);
        }
        const { userId, summaryId } = job.data as ScriptJobData;
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
            // フロー化時は子ジョブに任せるためここでは追加しない。
            // 直接呼び出し経路（通常運用）では、Flowを使わないため従来通り投入してもよいが
            // 現仕様ではフロー優先とし、ここではスキップする。

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

    private async processByDate(job: Job<ScriptByDateJobData>) {
        const { userId, summaryDate } = job.data;
        this.logger.log(
            `Processing script generation by date for user ${userId}, date: ${summaryDate}`,
        );
        try {
            const targetSummary =
                await this.dailySummaryRepository.findByUserAndDate(
                    userId,
                    summaryDate,
                );
            if (!targetSummary) {
                this.logger.warn(
                    `No summary found for user ${userId} on ${summaryDate}`,
                );
                return { success: true, skipped: true } as const;
            }
            if (targetSummary.hasScript()) {
                this.logger.log(
                    `Script already exists for summary on ${summaryDate}`,
                );
                return {
                    success: true,
                    summaryId: targetSummary.id,
                    hasExistingScript: true,
                };
            }

            const summaryItems =
                await this.dailySummaryRepository.getSummaryItems(
                    targetSummary.id,
                    userId,
                );
            const scriptRequest: GeminiScriptRequest = {
                summaryText: targetSummary.markdown || "",
                articlesForContext: summaryItems.map((item) => ({
                    title: `Feed Item ${item.feed_item_id}`,
                    url: `#${item.feed_item_id}`,
                })),
            };
            const scriptResponse =
                await this.llmService.generateScript(scriptRequest);
            await this.dailySummaryRepository.update(targetSummary.id, userId, {
                script_text: scriptResponse.script,
            });
            this.logger.log(
                `Script generated successfully for date ${summaryDate}`,
            );
            return {
                success: true,
                summaryId: targetSummary.id,
                scriptLength: scriptResponse.script.length,
                hasExistingScript: false,
            };
        } catch (error) {
            this.logger.error(
                `Failed to process script job by date: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }
}
