import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Queue } from "bullmq";
import {
    PODCAST_SCHEDULE_DEFAULT,
    SUMMARY_SCHEDULE_DEFAULT,
} from "@/settings/settings.constants";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import { JstDateService } from "@/shared/time/jst-date.service";

@Injectable()
export class JobsService implements OnModuleInit {
    private readonly logger = new Logger(JobsService.name);

    constructor(
        private readonly settingsRepo: UserSettingsRepository,
        private readonly time: JstDateService,
        // Summary/Podcastのrepeatableは中央スケジューラで管理するためキュー注入は不要
        @InjectQueue("maintenanceQueue")
        private readonly maintenanceQueue: Queue,
        @InjectQueue("feedQueue") private readonly feedQueue: Queue,
    ) {}

    async onModuleInit(): Promise<void> {
        this.time.warnIfTimezoneMismatch(this.logger);
        // Cron式を使わず、repeat.everyベースの軽量ハートビートで集中管理
        await this.registerMinutelySchedulerTick();
        await this.registerMinutelyFeedScan();
        await this.registerHourlyFailedCleanup();
    }

    // Cron式のrepeatable jobは廃止（中央スケジューラにより置換）。

    private async registerMinutelySchedulerTick(): Promise<void> {
        // 1分毎にスケジューラのティックをメンテナンスキューへ投入
        await this.maintenanceQueue.add(
            "scheduleTick",
            {},
            {
                repeat: { every: 60_000 },
                jobId: `scheduler-tick`,
                removeOnComplete: true,
                removeOnFail: 2,
            },
        );
        this.logger.log(`Registered minutely scheduler tick`);
    }

    private async registerHourlyFailedCleanup(): Promise<void> {
        // 1時間毎に全キューの失敗ジョブをクリーンアップ
        await this.maintenanceQueue.add(
            "cleanupQueues",
            {},
            {
                repeat: { every: 60 * 60 * 1000 },
                jobId: `cleanup-hourly`,
                removeOnComplete: true,
                removeOnFail: 2,
            },
        );
        this.logger.log(`Registered hourly failed jobs cleanup`);
    }

    private async registerMinutelyFeedScan(): Promise<void> {
        // 毎分、期限到達購読をスキャンし、feedQueueへ投入
        await this.feedQueue.add(
            "scanDueSubscriptions",
            {},
            {
                repeat: { every: 60_000 },
                jobId: `feed-scan-minutely`,
                removeOnComplete: true,
                removeOnFail: 2,
            },
        );
        this.logger.log(`Registered minutely feed scan job on feedQueue`);
    }

    // クリーニングは中央スケジューラ（scheduleTick）で行います。

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
    rescheduleUserRepeatableJobs(_userId: string): void {
        // Cron式のrepeatable jobは廃止。中央のscheduleTickで実行管理するため、ここでは何もしない。
        this.logger.log(
            "Using central scheduler tick. No per-user repeatable jobs to reschedule.",
        );
    }

    // ユーザーの次回実行時刻（repeatable job）を参照
    async getUserScheduleInfo(userId: string): Promise<{
        next_run_at_summary: string | null;
        next_run_at_podcast: string | null;
    }> {
        const settings = await this.settingsRepo.getByUserId(userId);
        const nowJst = this.time.now();

        const toNextIso = (hhmm: string | undefined, offsetMin = 0) => {
            if (!hhmm) return null;
            const base = this.parseTimeWithStableJitter(hhmm, userId);
            const target = this.addOffset(base.hour, base.minute, offsetMin);
            let candidate = this.time.setTime(
                nowJst,
                target.hour,
                target.minute,
            );
            if (candidate.getTime() <= nowJst.getTime()) {
                candidate = this.time.addDays(candidate, 1);
            }
            return candidate.toISOString();
        };

        const summaryTime = settings
            ? settings.summary_schedule_time
            : SUMMARY_SCHEDULE_DEFAULT;
        const podcastTime =
            settings?.podcast_schedule_time ?? PODCAST_SCHEDULE_DEFAULT;

        return {
            // summary はベース時刻（ジッターのみ、+0 分）
            next_run_at_summary: settings?.summary_enabled
                ? toNextIso(summaryTime, 0)
                : null,
            // podcast は summary の +10 分相当
            next_run_at_podcast:
                settings?.summary_enabled && settings?.podcast_enabled
                    ? toNextIso(podcastTime, 10)
                    : null,
        };
    }

    @Interval(6 * 60 * 60 * 1000)
    async verifyRepeatableJobs(): Promise<void> {
        await this.inspectRepeatableJobs(
            "maintenanceQueue",
            this.maintenanceQueue,
        );
        await this.inspectRepeatableJobs("feedQueue", this.feedQueue);
    }

    private async inspectRepeatableJobs(
        name: string,
        queue: Queue,
    ): Promise<void> {
        try {
            type RepeatableJobSummary = { key: string };
            type RepeatableAwareQueue = Queue & {
                getRepeatableJobs(
                    start?: number,
                    end?: number,
                    asc?: boolean,
                ): Promise<RepeatableJobSummary[]>;
            };

            const repeatableQueue = queue as RepeatableAwareQueue;

            if (typeof repeatableQueue.getRepeatableJobs !== "function") {
                this.logger.warn(
                    `[${name}] Queue adapter does not expose getRepeatableJobs(); ensure BullMQ >=5.48.0`,
                );
                return;
            }

            const repeatables = await repeatableQueue.getRepeatableJobs();
            if (repeatables.length === 0) {
                this.logger.warn(
                    `[${name}] No repeatable jobs registered. Verify scheduler bootstrap.`,
                );
                return;
            }
            const seen = new Set<string>();
            const duplicates: string[] = [];
            for (const job of repeatables) {
                if (seen.has(job.key)) {
                    duplicates.push(job.key);
                } else {
                    seen.add(job.key);
                }
            }
            if (duplicates.length > 0) {
                this.logger.warn(
                    `[${name}] Detected duplicate repeatable jobs: ${duplicates.join(", ")}`,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to inspect repeatable jobs for ${name}: ${(error as Error).message}`,
            );
        }
    }
}
