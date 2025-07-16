import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
// import { SupabaseRequestService } from '../supabase-request.service'; // DB直接操作はしない
// import { GeminiService } from './gemini.service'; // LLM直接呼び出しはしない

// 仕様書にあるキュー名
export const SUMMARY_GENERATE_QUEUE = 'summary-generate';
export const SCRIPT_GENERATE_QUEUE = 'script-generate';

@Injectable()
export class SummaryScriptService {
    private readonly logger = new Logger(SummaryScriptService.name);

    constructor(
        @InjectQueue(SUMMARY_GENERATE_QUEUE) private readonly summaryGenerateQueue: Queue,
        @InjectQueue(SCRIPT_GENERATE_QUEUE) private readonly scriptGenerateQueue: Queue,
        // private readonly supabase: SupabaseRequestService, // 不要になる
    ) {}

    // ユーザーIDに基づいて要約生成ジョブをキューに入れる
    // APIから呼ばれることを想定
    async requestSummaryGeneration(
        userId: string,
        // date?: string, // 仕様書ではuserIdのみ。日付はワーカーが当日や指定日を判断
        // articles?: any[] // これもワーカーが取得
        customPromptOverride?: string, // オプショナル: カスタムプロンプトを許可する場合
    ): Promise<{ jobId: string | undefined }> {
        this.logger.log(`Requesting summary generation for user: ${userId}`);
        // 仕様書のキューデータ: {userId}
        const job = await this.summaryGenerateQueue.add('generateUserSummary', {
            userId,
            customPromptOverride, // カスタムプロンプトをワーカーに渡す場合
        });
        this.logger.log(`Summary generation job ${job.id} added for user ${userId}`);
        return { jobId: job.id };
    }

    // サマリーIDに基づいて台本生成ジョブをキューに入れる
    // APIから呼ばれるか、要約生成ワーカーから呼ばれることもあり得る
    async requestScriptGeneration(
        summaryId: number, // daily_summaries.id
        customPromptOverride?: string, // オプショナル
    ): Promise<{ jobId: string | undefined }> {
        this.logger.log(`Requesting script generation for summaryId: ${summaryId}`);
        // 仕様書のキューデータ: {summaryId}
        const job = await this.scriptGenerateQueue.add('generateSummaryScript', {
            summaryId,
            customPromptOverride,
        });
        this.logger.log(`Script generation job ${job.id} added for summaryId ${summaryId}`);
        return { jobId: job.id };
    }
}
