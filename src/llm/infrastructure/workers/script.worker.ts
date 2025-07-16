import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
    GeminiScriptRequest,
    LLM_SERVICE,
    LlmService,
} from '../../application/services/llm.service';
import { DailySummaryRepository } from '../repositories/daily-summary.repository';

export interface ScriptJobData {
    userId: string;
    summaryId: number;
}

@Processor('script-generate')
@Injectable()
export class ScriptWorker extends WorkerHost {
    private readonly logger = new Logger(ScriptWorker.name);

    constructor(
        private readonly dailySummaryRepository: DailySummaryRepository,
        @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    ) {
        super();
    }

    async process(job: Job<ScriptJobData>) {
        const { userId, summaryId } = job.data;
        this.logger.log(
            `Processing script generation job for user ${userId}, summary ID: ${summaryId}`,
        );

        try {
            // 要約を取得
            const summary = await this.dailySummaryRepository.findByUserAndDate(userId, '');
            if (!summary || summary.id !== summaryId) {
                // ID直接での取得ができないため、ユーザーの要約一覧から検索
                const summaries = await this.dailySummaryRepository.findByUser(userId, 100, 0);
                const targetSummary = summaries.find((s) => s.id === summaryId);

                if (!targetSummary) {
                    throw new Error(
                        `Summary not found for user ${userId}, summary ID: ${summaryId}`,
                    );
                }

                if (!targetSummary.isCompleteSummary()) {
                    throw new Error(`Summary is not complete for summary ID: ${summaryId}`);
                }

                if (targetSummary.hasScript()) {
                    this.logger.log(`Script already exists for summary ID: ${summaryId}`);
                    return { success: true, summaryId, hasExistingScript: true };
                }

                // 関連するフィードアイテムを取得
                const summaryItems = await this.dailySummaryRepository.getSummaryItems(
                    summaryId,
                    userId,
                );

                // スクリプト生成用のリクエストデータを準備
                const scriptRequest: GeminiScriptRequest = {
                    summaryText: targetSummary.markdown || '',
                    articlesForContext: summaryItems.map((item) => ({
                        title: `Feed Item ${item.feed_item_id}`,
                        url: `#${item.feed_item_id}`,
                    })),
                };

                // LLMでスクリプト生成
                const scriptResponse = await this.llmService.generateScript(scriptRequest);

                // スクリプトを要約に追加
                await this.dailySummaryRepository.update(summaryId, userId, {
                    script_text: scriptResponse.script,
                });

                this.logger.log(`Script generated successfully for summary ID: ${summaryId}`);
                return {
                    success: true,
                    summaryId,
                    scriptLength: scriptResponse.script.length,
                    hasExistingScript: false,
                };
            }
        } catch (error) {
            this.logger.error(`Failed to process script job: ${error.message}`, error.stack);
            throw error;
        }
    }
}
