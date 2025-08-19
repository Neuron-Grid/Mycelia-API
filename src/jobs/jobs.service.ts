import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { SUMMARY_GENERATE_QUEUE } from "src/llm/application/services/summary-script.service";
import { UserSettingsRepository } from "src/shared/settings/user-settings.repository";

@Injectable()
export class JobsService implements OnModuleInit {
    private readonly logger = new Logger(JobsService.name);

    constructor(
        private readonly settingsRepo: UserSettingsRepository,
        @InjectQueue(SUMMARY_GENERATE_QUEUE)
        private readonly summaryQueue: Queue,
        @InjectQueue("podcastQueue") private readonly podcastQueue: Queue,
        @InjectQueue("maintenanceQueue")
        private readonly maintenanceQueue: Queue,
        @InjectQueue("feedQueue") private readonly feedQueue: Queue,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.registerDailySummaryJobs();
        await this.registerDailyPodcastJobs();
        await this.registerWeeklyMaintenanceJobs();
        await this.registerPodcastCleanupJobs();
        await this.registerMinutelyFeedScan();
    }

    private async registerDailySummaryJobs(): Promise<void> {
        const schedules =
            await this.settingsRepo.getAllEnabledSummarySchedules();
        for (const { userId, timeJst } of schedules) {
            const base = this.parseTimeWithStableJitter(timeJst, userId);
            const { hour, minute } = this.addOffset(base.hour, base.minute, 10);
            const pattern = `${minute} ${hour} * * *`;
            await this.summaryQueue.add(
                "generateUserSummary",
                { userId },
                {
                    repeat: { pattern, tz: "Asia/Tokyo" },
                    jobId: `summary-daily:${userId}`,
                    removeOnComplete: true,
                    removeOnFail: 5,
                },
            );
            this.logger.log(
                `Registered daily summary: user=${userId}, timeJST=${timeJst}, pattern=${pattern}`,
            );
        }
    }

    private async registerDailyPodcastJobs(): Promise<void> {
        const schedules =
            await this.settingsRepo.getAllEnabledPodcastSchedules();
        for (const { userId, timeJst } of schedules) {
            const base = this.parseTimeWithStableJitter(timeJst, userId);
            const { hour, minute } = this.addOffset(base.hour, base.minute, 10);
            const pattern = `${minute} ${hour} * * *`;
            await this.podcastQueue.add(
                "generatePodcastForToday",
                { userId },
                {
                    repeat: { pattern, tz: "Asia/Tokyo" },
                    jobId: `podcast-daily:${userId}`,
                    removeOnComplete: true,
                    removeOnFail: 5,
                },
            );
            this.logger.log(
                `Registered daily podcast: user=${userId}, timeJST=${timeJst}, pattern=${pattern}`,
            );
        }
    }

    private async registerWeeklyMaintenanceJobs(): Promise<void> {
        // 毎週日曜日 3:00 JST
        const pattern = `0 3 * * 0`;
        await this.maintenanceQueue.add(
            "weeklyReindex",
            {},
            {
                repeat: { pattern, tz: "Asia/Tokyo" },
                jobId: `weekly-reindex`,
                removeOnComplete: true,
                removeOnFail: 2,
            },
        );
        this.logger.log(
            `Registered weekly maintenance job (vector reindex) at JST 03:00 on Sundays`,
        );
    }

    private async registerMinutelyFeedScan(): Promise<void> {
        // 毎分0秒に期限到達購読をスキャンし、feedQueueへ投入
        const pattern = `0 * * * * *`;
        await this.feedQueue.add(
            "scanDueSubscriptions",
            {},
            {
                repeat: { pattern, tz: "Asia/Tokyo" },
                jobId: `feed-scan-minutely`,
                removeOnComplete: true,
                removeOnFail: 2,
            },
        );
        this.logger.log(
            `Registered minutely feed scan job on feedQueue (cron: ${pattern})`,
        );
    }

    private async registerPodcastCleanupJobs(): Promise<void> {
        // 毎日 04:00 JST に30日以上前のエピソードをユーザー毎にクリーンアップ
        const pattern = `0 4 * * *`;
        const daysOld = 30;
        const schedules =
            await this.settingsRepo.getAllEnabledPodcastSchedules();
        for (const { userId } of schedules) {
            await this.podcastQueue.add(
                "cleanupOldPodcasts",
                { userId, daysOld },
                {
                    repeat: { pattern, tz: "Asia/Tokyo" },
                    jobId: `podcast-cleanup-daily:${userId}`,
                    removeOnComplete: true,
                    removeOnFail: 5,
                },
            );
        }
        this.logger.log(
            `Registered daily podcast cleanup (>${daysOld} days) for ${schedules.length} users at JST 04:00`,
        );
    }

    // HH:mm に対し userId ハッシュベースの0-4分ジッターを追加（安定）
    private parseTimeWithStableJitter(
        time: string,
        userId: string,
    ): {
        hour: number;
        minute: number;
    } {
        const [hh, mm] = time.split(":").map((v) => Number.parseInt(v, 10));
        const jitter = this.hashToRange(userId, 0, 4); // 0-4分遅延（固定）
        const minute = (mm + jitter) % 60;
        const hour = (hh + Math.floor((mm + jitter) / 60)) % 24;
        return { hour, minute };
    }

    private hashToRange(key: string, min: number, max: number): number {
        // 簡易ハッシュ（安定）。maxは含む範囲。
        let h = 0;
        for (let i = 0; i < key.length; i++) {
            h = (h * 31 + key.charCodeAt(i)) >>> 0;
        }
        const span = max - min + 1;
        return min + (h % span);
    }

    private addOffset(
        hh: number,
        mm: number,
        addMin: number,
    ): {
        hour: number;
        minute: number;
    } {
        const total = hh * 60 + mm + addMin;
        const hour = Math.floor((total % (24 * 60)) / 60);
        const minute = total % 60;
        return { hour, minute };
    }

    // 設定更新後に、対象ユーザーのrepeatable jobのみを再登録
    async rescheduleUserRepeatableJobs(userId: string): Promise<void> {
        // 既存のrepeatable jobを削除
        const removeByPattern = async (queue: Queue, prefix: string) => {
            const jobs = await queue.getRepeatableJobs();
            for (const job of jobs) {
                // BullMQのRepeatableJobは key フィールドで一意に削除できる
                if (job.id?.startsWith(prefix)) {
                    await queue.removeRepeatableByKey(job.key);
                }
            }
        };

        await removeByPattern(this.summaryQueue, `summary-daily:${userId}`);
        await removeByPattern(this.podcastQueue, `podcast-daily:${userId}`);
        await removeByPattern(
            this.podcastQueue,
            `podcast-cleanup-daily:${userId}`,
        );

        // 再登録（現在のユーザー設定に基づく）
        const settings = await this.settingsRepo.getByUserId(userId);
        if (settings?.summary_enabled) {
            // 要約の再登録
            const timeJst =
                (await this.settingsRepo.getAllEnabledSummarySchedules()).find(
                    (s) => s.userId === userId,
                )?.timeJst || "06:00";
            const { hour, minute } = this.parseTimeWithStableJitter(
                timeJst,
                userId,
            );
            const pattern = `${minute} ${hour} * * *`;
            await this.summaryQueue.add(
                "generateUserSummary",
                { userId },
                {
                    repeat: { pattern, tz: "Asia/Tokyo" },
                    jobId: `summary-daily:${userId}`,
                    removeOnComplete: true,
                    removeOnFail: 5,
                },
            );
        }

        if (settings?.summary_enabled && settings?.podcast_enabled) {
            // ポッドキャストの再登録
            const timeJst =
                (await this.settingsRepo.getAllEnabledPodcastSchedules()).find(
                    (s) => s.userId === userId,
                )?.timeJst || "07:00";
            const { hour, minute } = this.parseTimeWithStableJitter(
                timeJst,
                userId,
            );
            const pattern = `${minute} ${hour} * * *`;
            await this.podcastQueue.add(
                "generatePodcastForToday",
                { userId },
                {
                    repeat: { pattern, tz: "Asia/Tokyo" },
                    jobId: `podcast-daily:${userId}`,
                    removeOnComplete: true,
                    removeOnFail: 5,
                },
            );

            // クリーニングも再登録
            const cleanupPattern = `0 4 * * *`;
            await this.podcastQueue.add(
                "cleanupOldPodcasts",
                { userId, daysOld: 30 },
                {
                    repeat: { pattern: cleanupPattern, tz: "Asia/Tokyo" },
                    jobId: `podcast-cleanup-daily:${userId}`,
                    removeOnComplete: true,
                    removeOnFail: 5,
                },
            );
        }
    }

    // ユーザーの次回実行時刻（repeatable job）を参照
    async getUserScheduleInfo(userId: string): Promise<{
        next_run_at_summary: string | null;
        next_run_at_podcast: string | null;
    }> {
        const toIso = (ms?: number): string | null =>
            ms && Number.isFinite(ms) ? new Date(ms).toISOString() : null;

        const summaryRepeat = (
            await this.summaryQueue.getRepeatableJobs()
        ).find((j) => j.id === `summary-daily:${userId}`);
        const podcastRepeat = (
            await this.podcastQueue.getRepeatableJobs()
        ).find((j) => j.id === `podcast-daily:${userId}`);

        return {
            next_run_at_summary: toIso(summaryRepeat?.next),
            next_run_at_podcast: toIso(podcastRepeat?.next),
        };
    }
}
