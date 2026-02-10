import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, Optional } from "@nestjs/common";
import { Queue } from "bullmq";
import { JstDateService } from "@/shared/time/jst-date.service";

export interface FeedFetchJobData {
    subscriptionId: number;
    userId: string;
    feedUrl: string;
    feedTitle: string;
}

export interface SummaryGenerationJobData {
    userId: string;
    summaryDate: string;
}

// NOTE: DTOクラスは ./podcast/queue/dto/podcast-generation-job.dto.ts で定義
// ここでは型互換性のためにinterface定義を残す
export interface PodcastGenerationJobData {
    userId: string;
    summaryId: number;
}

@Injectable()
export class FeedSchedulerService {
    private readonly logger = new Logger(FeedSchedulerService.name);

    constructor(
        @InjectQueue("feedQueue") private readonly feedQueue: Queue,
        @Optional()
        @InjectQueue("summary-generate")
        private readonly summaryQueue: Queue | null,
        @Optional()
        @InjectQueue("podcastQueue")
        private readonly podcastQueue: Queue | null,
        private readonly time: JstDateService,
    ) {}

    // Cron禁止により、スケジュールはJobsServiceのrepeat.everyに集約。
    // 当メソッドは未使用のノップです。
    scheduleFeedUpdates() {
        // no-op by design
        return;
    }

    // 以前は自動要約/ポッドキャスト/埋め込みのCronをここで投入していましたが、
    // スケジューリングは JobsService（repeatable jobs）に集約しました。
    // 当クラスのCronはフィード走査のノップ用途のみ残します。

    // 手動でフィード更新をトリガー
    async triggerFeedUpdate(subscriptionId: number, userId: string) {
        this.logger.log(
            `Manually triggering feed update for subscription ${subscriptionId}`,
        );
        // 引数で受け取った情報で直接ジョブを投入（存在確認はワーカー側で実施）
        const jobData: FeedFetchJobData = {
            subscriptionId,
            userId,
            // DTOのバリデーション要件を満たすためのプレースホルダ
            feedUrl: "https://example.com/placeholder",
            feedTitle: "Manual Trigger",
        };

        const job = await this.feedQueue.add("fetchFeed", jobData, {
            jobId: `manual-feed-${subscriptionId}-${Date.now()}`,
            attempts: 3,
            priority: 10,
        });

        return { jobId: job.id, message: "Feed update job queued" };
    }

    // 手動で要約生成をトリガー（必要時のみ利用）
    async triggerSummaryGeneration(userId: string, date?: string) {
        if (!this.summaryQueue) {
            return { jobId: null, message: "Summary module is not enabled" };
        }
        const summaryDate = date || this.time.formatDate(new Date());

        this.logger.log(
            `Manually triggering summary generation for user ${userId}, date ${summaryDate}`,
        );

        const jobData: SummaryGenerationJobData = {
            userId,
            summaryDate,
        };

        const job = await this.summaryQueue.add("generateSummary", jobData, {
            jobId: `manual-summary-${userId}-${summaryDate}-${Date.now()}`,
            attempts: 2,
            priority: 10,
        });

        return { jobId: job.id, message: "Summary generation job queued" };
    }

    // 手動でポッドキャスト生成をトリガー（必要時のみ利用）
    async triggerPodcastGeneration(userId: string, summaryId: number) {
        if (!this.podcastQueue) {
            return { jobId: null, message: "Podcast module is not enabled" };
        }
        this.logger.log(
            `Manually triggering podcast generation for user ${userId}, summary ${summaryId}`,
        );

        const jobData: PodcastGenerationJobData = {
            userId,
            summaryId,
        };

        const job = await this.podcastQueue.add("generatePodcast", jobData, {
            jobId: `manual-podcast-${userId}-${summaryId}-${Date.now()}`,
            attempts: 2,
            priority: 10,
        });

        return { jobId: job.id, message: "Podcast generation job queued" };
    }

    // 以前のサンプルメソッドはCron廃止に伴い削除しました。

    // キューの統計情報を取得
    async getQueueStats() {
        const [feedStats, summaryStats, podcastStats] = await Promise.all([
            this.feedQueue.getJobCounts(),
            this.summaryQueue?.getJobCounts() ?? null,
            this.podcastQueue?.getJobCounts() ?? null,
        ]);

        return {
            feedQueue: feedStats,
            summaryQueue: summaryStats,
            podcastQueue: podcastStats,
            timestamp: new Date().toISOString(),
        };
    }

    // 失敗したジョブをクリーンアップ
    async cleanupFailedJobs() {
        this.logger.log("Cleaning up failed jobs...");

        try {
            const cleanups: Promise<unknown>[] = [
                // 24時間前の失敗ジョブを10個まで削除
                this.feedQueue.clean(24 * 60 * 60 * 1000, 10, "failed"),
            ];
            if (this.summaryQueue) {
                cleanups.push(
                    this.summaryQueue.clean(24 * 60 * 60 * 1000, 5, "failed"),
                );
            }
            if (this.podcastQueue) {
                cleanups.push(
                    this.podcastQueue.clean(24 * 60 * 60 * 1000, 5, "failed"),
                );
            }
            await Promise.all(cleanups);

            this.logger.log("Failed job cleanup completed");
        } catch (error) {
            this.logger.error(`Failed job cleanup error: ${error.message}`);
        }
    }
}
