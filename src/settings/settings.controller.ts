import { TypedBody, TypedRoute } from "@nestia/core";
import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Controller, UseGuards } from "@nestjs/common";

import { User } from "@supabase/supabase-js";
import { Queue } from "bullmq";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { SupabaseUser } from "@/auth/supabase-user.decorator";
import {
    buildResponse,
    type SuccessResponse,
} from "@/common/utils/response.util";
import { DomainConfigService } from "@/domain-config/domain-config.service";
import { FlowOrchestratorService } from "@/jobs/flow-orchestrator.service";
import { JobsService } from "@/jobs/jobs.service";
import { DailySummaryRepository } from "@/llm/infrastructure/repositories/daily-summary.repository";
import { PodcastEpisodeRepository } from "@/podcast/infrastructure/podcast-episode.repository";
import { EnqueueFlowResponseDto } from "@/settings/dto/enqueue-flow.response.dto";
import { EnqueueJobResponseDto } from "@/settings/dto/enqueue-job.response.dto";
import { JobsStatusResponseDto } from "@/settings/dto/jobs-status.response.dto";
import { PreviewScheduleDto } from "@/settings/dto/preview-schedule.dto";
import { RunSummaryNowDto } from "@/settings/dto/run-summary-now.dto";
import { SchedulePreviewResponseDto } from "@/settings/dto/schedule-preview.response.dto";
import { SettingsMapper } from "@/settings/dto/settings.mapper";
import type { SettingsOverviewDto } from "@/settings/dto/settings-overview.dto";
import { UpdatePodcastSettingDto } from "@/settings/dto/update-podcast-setting.dto";
import { UpdateSummarySettingDto } from "@/settings/dto/update-summary-setting.dto";
import { UserSettingsBasicDto } from "@/settings/dto/user-settings-basic.dto";
import { UserSettingsBasicMapper } from "@/settings/dto/user-settings-basic.mapper";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";

@Controller()
@UseGuards(SupabaseAuthGuard)
export class SettingsController {
    constructor(
        private readonly jobsService: JobsService,
        private readonly userSettingsRepo: UserSettingsRepository,
        private readonly dailySummaryRepo: DailySummaryRepository,
        private readonly podcastRepo: PodcastEpisodeRepository,
        private readonly domainConfigService: DomainConfigService,
        private readonly flowOrchestrator: FlowOrchestratorService,
        @InjectQueue("summary-generate") private readonly summaryQueue: Queue,
        @InjectQueue("script-generate") private readonly scriptQueue: Queue,
        @InjectQueue("podcastQueue") private readonly podcastQueue: Queue,
    ) {}

    /**
     * User settings and schedule overview.
     * - 現在の設定と次回実行予定、直近の実行履歴概要を返します。
     */
    @TypedRoute.Get("settings")
    async getSettings(
        @SupabaseUser() user: User,
    ): Promise<SuccessResponse<SettingsOverviewDto>> {
        const userId = user.id;
        const base = await this.userSettingsRepo.getByUserId(userId);
        const next = await this.jobsService.getUserScheduleInfo(userId);

        // 最新履歴
        const summaries = await this.dailySummaryRepo.findByUser(userId, 1, 0);
        const latestSummary = summaries[0];
        const latestPodcast = (await this.podcastRepo.findByUser(userId, 1, 0))
            .episodes[0];

        // last_status（簡易推定）: 当日の要約ジョブの状態を参照
        const today = this.formatDateJst(new Date());
        const summaryJobId = `summary:${userId}:${today}`;
        const summaryJob = await this.summaryQueue.getJob(summaryJobId);
        let lastStatus: "success" | "failed" | "skipped" | "unknown" =
            "unknown";
        if (latestSummary) {
            lastStatus = "success";
        } else if (summaryJob) {
            const state = await summaryJob.getState();
            lastStatus = state === "failed" ? "failed" : "skipped";
        }

        const src = {
            summary_enabled: base?.summary_enabled ?? false,
            summary_schedule_time:
                (base?.summary_schedule_time as string) ?? null,
            podcast_enabled: base?.podcast_enabled ?? false,
            podcast_schedule_time:
                (base?.podcast_schedule_time as string) ?? null,
            podcast_language: base?.podcast_language ?? "ja-JP",
            next_run_at_summary: next.next_run_at_summary,
            next_run_at_podcast: next.next_run_at_podcast,
            last_summary_at: latestSummary?.updated_at ?? null,
            last_podcast_at: latestPodcast?.updated_at ?? null,
            last_status: lastStatus,
        } as const;
        return buildResponse(
            "Settings overview fetched",
            SettingsMapper.toDto(src),
        );
    }

    /**
     * Reload schedule (central scheduler; immediate effect).
     */
    @TypedRoute.Post("schedule/reload")
    async reloadMySchedule(@SupabaseUser() user: User): Promise<
        SuccessResponse<{
            nextRunAtSummary: string | null;
            nextRunAtPodcast: string | null;
        }>
    > {
        await this.jobsService.rescheduleUserRepeatableJobs(user.id);
        const next = await this.jobsService.getUserScheduleInfo(user.id);
        return buildResponse("Schedule reloaded", {
            nextRunAtSummary: next.next_run_at_summary ?? null,
            nextRunAtPodcast: next.next_run_at_podcast ?? null,
        });
    }

    /**
     * Preview next run times at a given JST time.
     * - 安定ジッター＋固定オフセットを考慮したサマリ/ポッドキャストの次回時刻を試算。
     */
    @TypedRoute.Post("schedule/preview")
    previewSchedule(
        @SupabaseUser() user: User,
        @TypedBody() body: PreviewScheduleDto,
    ): SuccessResponse<SchedulePreviewResponseDto> {
        const { timeJst } = body || ({} as PreviewScheduleDto);
        if (!/^([0-1]?\d|2[0-3]):[0-5]\d$/.test(String(timeJst))) {
            throw new BadRequestException("timeJst must be HH:mm (JST)");
        }
        const { hour: sH, minute: sM } = this.parseTimeWithStableJitter(
            timeJst,
            user.id,
        );
        const { hour: pH, minute: pM } = this.addOffset(sH, sM, 10);
        const now = new Date();
        const toIsoNext = (hh: number, mm: number) => {
            const d = new Date(now);
            d.setHours(hh, mm, 0, 0);
            if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
            return d.toISOString();
        };
        return buildResponse("Schedule preview", {
            nextRunAtSummary: toIsoNext(sH, sM),
            nextRunAtPodcast: toIsoNext(pH, pM),
        });
    }

    /**
     * Today's summary → script → podcast progress.
     */
    @TypedRoute.Get("jobs/status")
    async jobsStatus(
        @SupabaseUser() user: User,
    ): Promise<SuccessResponse<JobsStatusResponseDto>> {
        const userId = user.id;
        const today = this.formatDateJst(new Date());
        const summaryJobId = `summary:${userId}:${today}`;
        const summaryJob = await this.summaryQueue.getJob(summaryJobId);

        const summary = await this.dailySummaryRepo.findByUserAndDate(
            userId,
            today,
        );

        // summary 状態
        let summaryState:
            | "waiting"
            | "active"
            | "completed"
            | "failed"
            | "skipped"
            | "idle" = "idle";
        if (summary?.isCompleteSummary()) {
            summaryState = "completed";
        } else if (summaryJob) {
            const st = await summaryJob.getState();
            summaryState = (st as typeof summaryState) ?? "waiting";
        } else {
            summaryState = "idle";
        }

        // script 状態
        let scriptState:
            | "waiting"
            | "active"
            | "completed"
            | "failed"
            | "skipped"
            | "idle" = "idle";
        if (!summary) {
            scriptState = "skipped";
        } else if (summary.hasScript()) {
            scriptState = "completed";
        } else {
            const scriptJob = await this.scriptQueue.getJob(
                `script:${summary.id}`,
            );
            if (scriptJob) {
                const st = await scriptJob.getState();
                scriptState = (st as typeof scriptState) ?? "waiting";
            } else {
                scriptState = "idle";
            }
        }

        // podcast 状態
        let podcastState:
            | "waiting"
            | "active"
            | "completed"
            | "failed"
            | "skipped"
            | "idle" = "idle";
        if (!summary) {
            podcastState = "skipped";
        } else {
            const episode = summary
                ? await this.podcastRepo.findBySummaryId(userId, summary.id)
                : null;
            if (episode?.hasAudio()) {
                podcastState = "completed";
            } else {
                const podcastJob = await this.podcastQueue.getJob(
                    `podcast:${userId}:${summary?.id}`,
                );
                if (podcastJob) {
                    const st = await podcastJob.getState();
                    podcastState = (st as typeof podcastState) ?? "waiting";
                } else {
                    podcastState = "idle";
                }
            }
        }

        return buildResponse("Jobs status fetched", {
            date: today,
            summary: { state: summaryState, jobId: summaryJobId },
            script: {
                state: scriptState,
                jobId: summary ? `script:${summary.id}` : null,
            },
            podcast: {
                state: podcastState,
                jobId: summary ? `podcast:${userId}:${summary.id}` : null,
            },
        });
    }

    /**
     * Update summary feature enabled/disabled.
     * - 中央スケジューラにより即時反映（安定ジッター適用）。
     */
    @TypedRoute.Put("settings/summary")
    async updateSummarySetting(
        @SupabaseUser() user: User,
        @TypedBody() body: UpdateSummarySettingDto,
    ): Promise<SuccessResponse<UserSettingsBasicDto>> {
        if (typeof body?.enabled !== "boolean") {
            throw new BadRequestException("enabled must be boolean");
        }

        const scheduleTime =
            body.summaryScheduleTime === null
                ? undefined
                : (body.summaryScheduleTime ?? undefined);

        if (body.enabled && !scheduleTime) {
            throw new BadRequestException(
                "summaryScheduleTime is required when enabling summary",
            );
        }

        await this.domainConfigService.updateSummarySettings(
            user.id,
            body.enabled,
            scheduleTime,
        );
        await this.jobsService.rescheduleUserRepeatableJobs(user.id);
        const updated = await this.userSettingsRepo.getByUserId(user.id);
        return buildResponse(
            "Summary setting updated",
            UserSettingsBasicMapper.fromRepoRow(updated),
        );
    }

    /**
     * Update podcast settings (enabled/time/language).
     * - 指定時刻（JST）＋安定ジッター、要約実行の+10分後に実施。
     */
    @TypedRoute.Put("settings/podcast")
    async updatePodcastSetting(
        @SupabaseUser() user: User,
        @TypedBody() body: UpdatePodcastSettingDto,
    ): Promise<SuccessResponse<UserSettingsBasicDto>> {
        if (typeof body?.enabled !== "boolean")
            throw new BadRequestException("enabled must be boolean");
        const settings = await this.userSettingsRepo.getByUserId(user.id);
        if (body.enabled && !settings?.summary_enabled) {
            throw new BadRequestException(
                "Podcast cannot be enabled when summary is disabled",
            );
        }
        await this.domainConfigService.updatePodcastSettings(
            user.id,
            body.enabled,
            body.time,
            body.language,
        );
        await this.jobsService.rescheduleUserRepeatableJobs(user.id);
        const row = await this.userSettingsRepo.getByUserId(user.id);
        return buildResponse(
            "Podcast setting updated",
            UserSettingsBasicMapper.fromRepoRow(row),
        );
    }

    /**
     * Enqueue today's summary → script → podcast flow immediately (idempotent).
     */
    @TypedRoute.Post("summaries/run-now")
    async runSummaryNow(
        @SupabaseUser() user: User,
        @TypedBody() body?: RunSummaryNowDto,
    ): Promise<SuccessResponse<EnqueueFlowResponseDto>> {
        const dateJst = body?.date ?? this.formatDateJst(new Date());
        const flow = await this.flowOrchestrator.createDailyFlow(
            user.id,
            dateJst,
        );
        return buildResponse("Enqueued", {
            enqueued: true,
            flowId: flow.flowId,
            date: dateJst,
        });
    }

    /**
     * Enqueue podcast generation for today if a summary exists (idempotent).
     */
    @TypedRoute.Post("podcasts/run-now")
    async runPodcastNow(
        @SupabaseUser() user: User,
    ): Promise<SuccessResponse<EnqueueJobResponseDto>> {
        const today = this.formatDateJst(new Date());
        const job = await this.podcastQueue.add(
            "generatePodcastForToday",
            { userId: user.id },
            {
                jobId: `podcast-for-today:${user.id}:${today}`,
                removeOnComplete: true,
                removeOnFail: 5,
            },
        );
        return buildResponse("Enqueued", {
            jobId: job?.id ?? `podcast-for-today:${user.id}:${today}`,
        });
    }

    private formatDateJst(date: Date): string {
        const utc = date.getTime() + date.getTimezoneOffset() * 60000;
        const jst = new Date(utc + 9 * 60 * 60000);
        const yyyy = jst.getFullYear();
        const mm = String(jst.getMonth() + 1).padStart(2, "0");
        const dd = String(jst.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    private parseTimeWithStableJitter(
        time: string,
        userId: string,
    ): { hour: number; minute: number } {
        const [hh, mm] = time.split(":").map((v) => Number.parseInt(v, 10));
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

    private hashToRange(key: string, min: number, max: number) {
        let h = 0;
        for (let i = 0; i < key.length; i++) {
            h = (h * 31 + key.charCodeAt(i)) >>> 0;
        }
        const span = max - min + 1;
        return min + (h % span);
    }
}
