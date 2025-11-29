import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import type { WorkerPodcastSchedule } from "@/shared/settings/worker-user-settings.repository";
import { WorkerUserSettingsRepository } from "@/shared/settings/worker-user-settings.repository";
import { JstDateService } from "@/shared/time/jst-date.service";
import { MaintenanceService } from "./maintenance.service";

type ScheduleTickData = {
    summaryOffset?: number;
    podcastOffset?: number;
    processSummary?: boolean;
    processPodcast?: boolean;
    tickId?: string;
};

@Processor("maintenanceQueue")
@Injectable()
export class MaintenanceQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(MaintenanceQueueProcessor.name);
    private static readonly SUMMARY_PAGE_SIZE = 500;
    private static readonly PODCAST_PAGE_SIZE = 500;

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
        private readonly time: JstDateService,
    ) {
        super();
        this.time.warnIfTimezoneMismatch(this.logger);
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
                await this.handleScheduleTick(
                    job as Job<ScheduleTickData, unknown, string>,
                );
                return { success: true };
            }
            default:
                this.logger.warn(`Unknown maintenance job: ${job.name}`);
                return { success: false };
        }
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

    private async handleScheduleTick(
        job: Job<ScheduleTickData, unknown, string>,
    ): Promise<void> {
        const {
            summaryOffset = 0,
            podcastOffset = 0,
            processSummary = true,
            processPodcast = true,
            tickId,
        } = job.data ?? {};

        const now = this.time.now();
        const parts = this.time.getParts(now);
        const h = Number.parseInt(parts.hour, 10);
        const m = Number.parseInt(parts.minute, 10);
        const dateStr = this.time.formatDate(now);
        const effectiveTickId =
            tickId ?? job.id ?? `tick-${job.timestamp ?? Date.now()}`;
        const isPrimaryTick =
            processSummary &&
            processPodcast &&
            summaryOffset === 0 &&
            podcastOffset === 0;
        const weekday = this.time.getWeekday(now);

        // 1) ユーザー毎のサマリ実行判定（summary: ベース時刻そのまま）
        if (processSummary) {
            const summaries =
                await this.userSettingsRepo.getAllEnabledSummarySchedules({
                    offset: summaryOffset,
                    limit: MaintenanceQueueProcessor.SUMMARY_PAGE_SIZE,
                });

            for (const { userId, timeJst } of summaries) {
                const base = this.parseTimeWithStableJitter(timeJst, userId);
                // summary は +0 分（ジッターのみ）
                const { hour, minute } = this.addOffset(
                    base.hour,
                    base.minute,
                    0,
                );
                if (hour === h && minute === m) {
                    await this.summaryQueue.add(
                        "generateUserSummary",
                        { userId },
                        {
                            jobId: `summary:${userId}:${dateStr}`,
                            removeOnComplete: true,
                            removeOnFail: 5,
                        },
                    );
                }
            }

            if (
                summaries.length === MaintenanceQueueProcessor.SUMMARY_PAGE_SIZE
            ) {
                await this.maintenanceQueue.add(
                    "scheduleTick",
                    {
                        summaryOffset:
                            summaryOffset +
                            MaintenanceQueueProcessor.SUMMARY_PAGE_SIZE,
                        podcastOffset,
                        processSummary: true,
                        processPodcast: false,
                        tickId: effectiveTickId,
                    },
                    {
                        jobId: `${effectiveTickId}:summary:${
                            summaryOffset +
                            MaintenanceQueueProcessor.SUMMARY_PAGE_SIZE
                        }`,
                        delay: 250,
                        removeOnComplete: true,
                        removeOnFail: 2,
                    },
                );
            }
        }

        // 2) ユーザー毎のポッドキャスト実行判定（podcast: summary の +10 分）
        let podcasts: WorkerPodcastSchedule[] = [];
        if (processPodcast) {
            podcasts =
                await this.userSettingsRepo.getAllEnabledPodcastSchedules({
                    offset: podcastOffset,
                    limit: MaintenanceQueueProcessor.PODCAST_PAGE_SIZE,
                });
            for (const { userId, timeJst } of podcasts) {
                const base = this.parseTimeWithStableJitter(timeJst, userId);
                const { hour, minute } = this.addOffset(
                    base.hour,
                    base.minute,
                    10,
                );
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

            if (
                podcasts.length === MaintenanceQueueProcessor.PODCAST_PAGE_SIZE
            ) {
                await this.maintenanceQueue.add(
                    "scheduleTick",
                    {
                        summaryOffset: 0,
                        podcastOffset:
                            podcastOffset +
                            MaintenanceQueueProcessor.PODCAST_PAGE_SIZE,
                        processSummary: false,
                        processPodcast: true,
                        tickId: effectiveTickId,
                    },
                    {
                        jobId: `${effectiveTickId}:podcast:${
                            podcastOffset +
                            MaintenanceQueueProcessor.PODCAST_PAGE_SIZE
                        }`,
                        delay: 250,
                        removeOnComplete: true,
                        removeOnFail: 2,
                    },
                );
            }
        }

        // 3) 04:00 に旧ポッドキャストをクリーンアップ
        if (h === 4 && m === 0 && processPodcast) {
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
        if (isPrimaryTick && weekday === 0 && h === 3 && m === 0) {
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
        if (isPrimaryTick && weekday === 1 && h === 3 && m === 0) {
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
