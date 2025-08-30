import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
// import { SupabaseRequestService } from '../supabase-request.service'; // DB直接操作はしない
// import { GeminiService } from './gemini.service'; // LLM直接呼び出しはしない
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";

// 仕様書にあるキュー名
export const SUMMARY_GENERATE_QUEUE = "summary-generate";
export const SCRIPT_GENERATE_QUEUE = "script-generate";

@Injectable()
export class SummaryScriptService {
    private readonly logger = new Logger(SummaryScriptService.name);

    constructor(
        @InjectQueue(SUMMARY_GENERATE_QUEUE)
        private readonly summaryGenerateQueue: Queue,
        @InjectQueue(SCRIPT_GENERATE_QUEUE)
        private readonly scriptGenerateQueue: Queue,
        private readonly userSettingsRepo: UserSettingsRepository,
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
        // 機能フラグガード: 要約が無効な場合は投入しない
        const settings = await this.userSettingsRepo.getByUserId(userId);
        if (!settings?.summary_enabled) {
            this.logger.warn(
                `Summary generation disabled for user ${userId}. Skipping enqueue.`,
            );
            return { jobId: undefined };
        }
        // 仕様書のキューデータ: {userId}
        // 当日分の冪等性確保のため、JST日付ベースのjobIdを付与
        const todayJst = this.formatDateJst(new Date());
        const job = await this.summaryGenerateQueue.add(
            "generateUserSummary",
            {
                userId,
                customPromptOverride, // カスタムプロンプトをワーカーに渡す場合
            },
            {
                jobId: `summary:${userId}:${todayJst}`,
                removeOnComplete: 5,
                removeOnFail: 10,
                attempts: 3,
                backoff: { type: "fixed", delay: 30_000 },
            },
        );
        this.logger.log(
            `Summary generation job ${job.id} added for user ${userId}`,
        );
        return { jobId: job.id?.toString() };
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

    // サマリーIDに基づいて台本生成ジョブをキューに入れる
    // APIから呼ばれるか、要約生成ワーカーから呼ばれることもあり得る
    async requestScriptGeneration(
        userId: string,
        summaryId: number, // daily_summaries.id
        customPromptOverride?: string, // オプショナル
    ): Promise<{ jobId: string | undefined }> {
        this.logger.log(
            `Requesting script generation for user ${userId}, summaryId: ${summaryId}`,
        );
        // 仕様書のキューデータ: {summaryId}
        const job = await this.scriptGenerateQueue.add(
            "generateSummaryScript",
            {
                userId,
                summaryId,
                customPromptOverride,
            },
        );
        this.logger.log(
            `Script generation job ${job.id} added for summaryId ${summaryId}`,
        );
        return { jobId: job.id?.toString() };
    }
}
