import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { WorkerUserSettingsRepository } from "src/shared/settings/worker-user-settings.repository";
import { MaintenanceService } from "./maintenance.service";

@Processor("maintenanceQueue")
@Injectable()
export class MaintenanceQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(MaintenanceQueueProcessor.name);

    constructor(
        private readonly maintenance: MaintenanceService,
        @InjectQueue("feedQueue") private readonly feedQueue: Queue,
        @InjectQueue("embeddingQueue") private readonly embeddingQueue: Queue,
        @InjectQueue("summary-generate") private readonly summaryQueue: Queue,
        @InjectQueue("script-generate") private readonly scriptQueue: Queue,
        @InjectQueue("podcastQueue") private readonly podcastQueue: Queue,
        @InjectQueue("accountDeletionQueue")
        private readonly accountDeletionQueue: Queue,
        @InjectQueue("maintenanceQueue")
        private readonly maintenanceQueue: Queue,
        private readonly userSettingsRepo: WorkerUserSettingsRepository,
    ) {
        super();
    }

    async process(job: Job) {
        switch (job.name) {
            case "weeklyReindex":
                await this.maintenance.rebuildVectorIndexes();
                this.logger.log("Weekly vector reindex completed");
                return { success: true };
            case "cleanupQueues": {
                // 24hより古い失敗ジョブを各キューでクリーン
                const dayMs = 24 * 60 * 60 * 1000;
                await Promise.allSettled([
                    this.feedQueue.clean(dayMs, 50, "failed"),
                    this.embeddingQueue.clean(dayMs, 50, "failed"),
                    this.summaryQueue.clean(dayMs, 50, "failed"),
                    this.scriptQueue.clean(dayMs, 50, "failed"),
                    this.podcastQueue.clean(dayMs, 50, "failed"),
                ]);
                this.logger.log("Failed jobs cleanup completed across queues");
                return { success: true };
            }
            case "scheduleTick": {
                await this.handleScheduleTick();
                return { success: true };
            }
            default:
                this.logger.warn(`Unknown maintenance job: ${job.name}`);
        }
    }

    private nowJst(): Date {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        return new Date(utc + 9 * 60 * 60000);
    }

    private formatDateJst(d: Date): string {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    private hashToRange(key: string, min: number, max: number) {
        let h = 0;
        for (let i = 0; i < key.length; i++)
            h = (h * 31 + key.charCodeAt(i)) >>> 0;
        const span = max - min + 1;
        return min + (h % span);
    }

    private parseTimeWithStableJitter(timeJst: string, userId: string) {
        const [hh, mm] = timeJst.split(":").map((v) => Number.parseInt(v, 10));
        const jitter = this.hashToRange(userId, 0, 4);
        const minute = (mm + jitter) % 60;
        const hour = (hh + Math.floor((mm + jitter) / 60)) % 24;
        return { hour, minute };
    }

    private addOffset(hh: number, mm: number, addMin: number) {
        const total = hh * 60 + mm + addMin;
        const hour = Math.floor((total % (24 * 60)) / 60);
        const minute = total % 60;
        return { hour, minute };
    }

    private async handleScheduleTick(): Promise<void> {
        const now = this.nowJst();
        const h = now.getHours();
        const m = now.getMinutes();
        const dateStr = this.formatDateJst(now);

        // 1) ユーザー毎のサマリ実行判定
        const summaries =
            await this.userSettingsRepo.getAllEnabledSummarySchedules();
        for (const { userId, timeJst } of summaries) {
            const base = this.parseTimeWithStableJitter(timeJst, userId);
            const { hour, minute } = this.addOffset(base.hour, base.minute, 10);
            if (hour === h && minute === m) {
                await this.summaryQueue.add(
                    "generateUserSummary",
                    { userId },
                    {
                        jobId: `summary-daily:${userId}:${dateStr}`,
                        removeOnComplete: true,
                        removeOnFail: 5,
                    },
                );
            }
        }

        // 2) ユーザー毎のポッドキャスト実行判定
        const podcasts =
            await this.userSettingsRepo.getAllEnabledPodcastSchedules();
        for (const { userId, timeJst } of podcasts) {
            const base = this.parseTimeWithStableJitter(timeJst, userId);
            const { hour, minute } = this.addOffset(base.hour, base.minute, 10);
            if (hour === h && minute === m) {
                await this.podcastQueue.add(
                    "generatePodcastForToday",
                    { userId },
                    {
                        jobId: `podcast-daily:${userId}:${dateStr}`,
                        removeOnComplete: true,
                        removeOnFail: 5,
                    },
                );
            }
        }

        // 3) 04:00 に旧ポッドキャストをクリーンアップ
        if (h === 4 && m === 0) {
            const daysOld = 30;
            for (const { userId } of podcasts) {
                await this.podcastQueue.add(
                    "cleanupOldPodcasts",
                    { userId, daysOld },
                    {
                        jobId: `podcast-cleanup-daily:${userId}:${dateStr}`,
                        removeOnComplete: true,
                        removeOnFail: 5,
                    },
                );
            }
        }

        // 4) 毎週日曜 03:00 にベクトルインデックス再構築
        if (now.getDay() === 0 && h === 3 && m === 0) {
            await this.maintenanceQueue.add(
                "weeklyReindex",
                {},
                {
                    jobId: `weekly-reindex:${dateStr}`,
                    removeOnComplete: true,
                    removeOnFail: 2,
                },
            );
        }

        // 5) 毎週月曜 03:00 にアカウント一括物理削除アグリゲータを投入
        if (now.getDay() === 1 && h === 3 && m === 0) {
            await this.accountDeletionQueue.add(
                "aggregateDeletion",
                {},
                {
                    jobId: `account-aggregate:${dateStr}`,
                    removeOnComplete: true,
                    removeOnFail: 2,
                },
            );
        }
    }
}
