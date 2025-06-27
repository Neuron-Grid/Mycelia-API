import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Queue } from "bullmq";
import { SubscriptionService } from "./subscription.service";

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

export interface PodcastGenerationJobData {
    userId: string;
    summaryId: number;
}

@Injectable()
export class FeedSchedulerService {
    private readonly logger = new Logger(FeedSchedulerService.name);

    constructor(
        private readonly subscriptionService: SubscriptionService,
        @InjectQueue("feedQueue") private readonly feedQueue: Queue,
        @InjectQueue("summary-generate") private readonly summaryQueue: Queue,
        @InjectQueue("podcastQueue") private readonly podcastQueue: Queue,
    ) {}

    // 毎分実行: 期限到達したRSSフィードをチェック
    @Cron(CronExpression.EVERY_MINUTE)
    async scheduleFeedUpdates() {
        this.logger.log("Checking for due RSS feed subscriptions...");

        try {
            const dueSubscriptions = await this.subscriptionService
                .findDueSubscriptions(new Date());

            if (dueSubscriptions.length === 0) {
                this.logger.debug("No due subscriptions found");
                return;
            }

            this.logger.log(
                `Found ${dueSubscriptions.length} due subscriptions`,
            );

            // 各購読をキューに追加
            for (const subscription of dueSubscriptions) {
                const jobData: FeedFetchJobData = {
                    subscriptionId: subscription.id,
                    userId: subscription.user_id,
                    feedUrl: subscription.feed_url,
                    feedTitle: subscription.feed_title || "Unknown Feed",
                };

                await this.feedQueue.add("fetchFeed", jobData, {
                    // 重複防止: 同一購読IDのジョブは1つまで
                    jobId: `feed-${subscription.id}`,
                    // 失敗時の再試行設定
                    attempts: 3,
                    backoff: {
                        type: "exponential",
                        delay: 2000,
                    },
                    // 5分以内に処理されなければ削除
                    removeOnComplete: 10,
                    removeOnFail: 5,
                });

                this.logger.debug(
                    `Queued feed fetch job for subscription ${subscription.id}`,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to schedule feed updates: ${error.message}`,
                error.stack,
            );
        }
    }

    // 毎時0分に実行: 自動要約生成をチェック
    @Cron("0 0 * * * *") // 毎時0分
    async scheduleAutoSummaries() {
        this.logger.log("Checking for auto summary generation...");

        try {
            // アクティブなユーザーを取得（最近24時間でフィードアイテムがあるユーザー）
            const activeUsers = await this.getActiveUsersForSummary();

            for (const userId of activeUsers) {
                const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

                const jobData: SummaryGenerationJobData = {
                    userId,
                    summaryDate: today,
                };

                await this.summaryQueue.add("generateSummary", jobData, {
                    jobId: `summary-${userId}-${today}`,
                    attempts: 2,
                    backoff: {
                        type: "exponential",
                        delay: 5000,
                    },
                    // 要約は長時間かかる可能性があるため長めのタイムアウト
                    removeOnComplete: 3,
                    removeOnFail: 3,
                });

                this.logger.debug(
                    `Queued summary generation for user ${userId}`,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to schedule auto summaries: ${error.message}`,
                error.stack,
            );
        }
    }

    // 毎日午前7時と午後6時に実行: ポッドキャスト生成
    @Cron("0 0 7,18 * * *") // 7時と18時
    async scheduleAutoPodcasts() {
        this.logger.log("Checking for auto podcast generation...");

        try {
            // ポッドキャスト設定が有効なユーザーの要約を取得
            const podcastUsers = await this.getActiveUsersForPodcast();

            for (const { userId, summaryId } of podcastUsers) {
                const jobData: PodcastGenerationJobData = {
                    userId,
                    summaryId,
                };

                await this.podcastQueue.add("generatePodcast", jobData, {
                    jobId: `podcast-${userId}-${summaryId}`,
                    attempts: 2,
                    backoff: {
                        type: "exponential",
                        delay: 10000,
                    },
                    removeOnComplete: 5,
                    removeOnFail: 3,
                });

                this.logger.debug(
                    `Queued podcast generation for user ${userId}, summary ${summaryId}`,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to schedule auto podcasts: ${error.message}`,
                error.stack,
            );
        }
    }

    // 手動でフィード更新をトリガー
    async triggerFeedUpdate(subscriptionId: number, userId: string) {
        this.logger.log(
            `Manually triggering feed update for subscription ${subscriptionId}`,
        );

        const subscription = await this.subscriptionService.getSubscriptionById(
            userId,
            subscriptionId,
        );
        if (!subscription) {
            throw new Error("Subscription not found");
        }

        const jobData: FeedFetchJobData = {
            subscriptionId: subscription.id,
            userId: subscription.user_id,
            feedUrl: subscription.feed_url,
            feedTitle: subscription.feed_title || "Unknown Feed",
        };

        const job = await this.feedQueue.add("fetchFeed", jobData, {
            jobId: `manual-feed-${subscriptionId}-${Date.now()}`,
            attempts: 3,
            // 手動更新は高優先度
            priority: 10,
        });

        return { jobId: job.id, message: "Feed update job queued" };
    }

    // 手動で要約生成をトリガー
    async triggerSummaryGeneration(userId: string, date?: string) {
        const summaryDate = date || new Date().toISOString().split("T")[0];

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

    // 手動でポッドキャスト生成をトリガー
    async triggerPodcastGeneration(userId: string, summaryId: number) {
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

    // 要約生成対象のアクティブユーザーを取得
    private getActiveUsersForSummary(): Promise<string[]> {
        // 実装例: 最近24時間でフィードアイテムが追加されたユーザー
        // この実装は簡略化されており、実際のクエリが必要

        // TODO: RepositoryまたはDatabaseサービスから取得
        // const activeUsers = await this.someRepository.getActiveUsers()

        // 暫定的に空配列を返す
        return Promise.resolve([]);
    }

    // ポッドキャスト生成対象のユーザーと要約を取得
    private getActiveUsersForPodcast(): Promise<
        Array<{ userId: string; summaryId: number }>
    > {
        // 実装例: ポッドキャスト設定が有効で、当日の要約があるユーザー

        // TODO: RepositoryまたはDatabaseサービスから取得
        // const podcastUsers = await this.someRepository.getPodcastEnabledUsers()

        // 暫定的に空配列を返す
        return Promise.resolve([]);
    }

    // キューの統計情報を取得
    async getQueueStats() {
        const [feedStats, summaryStats, podcastStats] = await Promise.all([
            this.feedQueue.getJobCounts(),
            this.summaryQueue.getJobCounts(),
            this.podcastQueue.getJobCounts(),
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
            await Promise.all([
                // 24時間前の失敗ジョブを10個まで削除
                this.feedQueue.clean(24 * 60 * 60 * 1000, 10, "failed"),
                this.summaryQueue.clean(24 * 60 * 60 * 1000, 5, "failed"),
                this.podcastQueue.clean(24 * 60 * 60 * 1000, 5, "failed"),
            ]);

            this.logger.log("Failed job cleanup completed");
        } catch (error) {
            this.logger.error(`Failed job cleanup error: ${error.message}`);
        }
    }
}
