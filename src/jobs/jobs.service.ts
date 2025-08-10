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
    ) {}

    async onModuleInit(): Promise<void> {
        await this.registerDailySummaryJobs();
        await this.registerDailyPodcastJobs();
        await this.registerWeeklyMaintenanceJobs();
        await this.registerPodcastCleanupJobs();
    }

    private async registerDailySummaryJobs(): Promise<void> {
        const schedules =
            await this.settingsRepo.getAllEnabledSummarySchedules();
        for (const { userId, timeJst } of schedules) {
            const { hour, minute } = this.parseTimeWithJitter(timeJst);
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
            const { hour, minute } = this.parseTimeWithJitter(timeJst);
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

    // HH:mmに対し0-4分のジッターを追加
    private parseTimeWithJitter(time: string): {
        hour: number;
        minute: number;
    } {
        const [hh, mm] = time.split(":").map((v) => parseInt(v, 10));
        const jitter = Math.floor(Math.random() * 5); // 0-4分遅延
        const minute = (mm + jitter) % 60;
        const hour = (hh + Math.floor((mm + jitter) / 60)) % 24;
        return { hour, minute };
    }
}
