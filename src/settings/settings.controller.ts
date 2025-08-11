import { InjectQueue } from "@nestjs/bullmq";
import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Post,
    Put,
    UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { User } from "@supabase/supabase-js";
import { Queue } from "bullmq";
import { SupabaseAuthGuard } from "src/auth/supabase-auth.guard";
import { SupabaseUser } from "src/auth/supabase-user.decorator";
import { DomainConfigService } from "src/domain-config/domain-config.service";
import { FlowOrchestratorService } from "src/jobs/flow-orchestrator.service";
import { JobsService } from "src/jobs/jobs.service";
import { DailySummaryRepository } from "src/llm/infrastructure/repositories/daily-summary.repository";
import { PodcastEpisodeRepository } from "src/podcast/infrastructure/podcast-episode.repository";
import { UserSettingsRepository } from "src/shared/settings/user-settings.repository";

@ApiTags("settings")
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

    @Get("settings")
    @ApiOperation({ summary: "ユーザー設定とスケジュールの統合ビュー" })
    @ApiBearerAuth()
    async getSettings(@SupabaseUser() user: User) {
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

        return {
            summary_enabled: base?.summary_enabled ?? false,
            podcast_enabled: base?.podcast_enabled ?? false,
            podcast_schedule_time:
                (base?.podcast_schedule_time as string) ?? null,
            podcast_language: base?.podcast_language ?? "ja-JP",
            next_run_at_summary: next.next_run_at_summary,
            next_run_at_podcast: next.next_run_at_podcast,
            last_summary_at: latestSummary?.updated_at ?? null,
            last_podcast_at: latestPodcast?.updated_at ?? null,
            last_status: lastStatus,
        };
    }

    @Post("schedule/reload")
    @ApiOperation({ summary: "自身のrepeatable jobを再登録（即時反映）" })
    @ApiBearerAuth()
    async reloadMySchedule(@SupabaseUser() user: User) {
        await this.jobsService.rescheduleUserRepeatableJobs(user.id);
        const next = await this.jobsService.getUserScheduleInfo(user.id);
        return { reloaded: true, ...next };
    }

    @Post("schedule/preview")
    @ApiOperation({
        summary: "指定JST時刻の次回実行（ジッター+固定オフセット適用）",
    })
    @ApiBearerAuth()
    previewSchedule(
        @SupabaseUser() user: User,
        @Body() body: { timeJst: string },
    ) {
        const { timeJst } = body || {};
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
        return {
            next_run_at_summary: toIsoNext(sH, sM),
            next_run_at_podcast: toIsoNext(pH, pM),
        };
    }

    @Get("jobs/status")
    @ApiOperation({ summary: "当日の要約→台本→ポッドキャスト進捗" })
    @ApiBearerAuth()
    async jobsStatus(@SupabaseUser() user: User) {
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

        return {
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
        };
    }

    @Put("settings/summary")
    @ApiOperation({ summary: "要約機能の有効/無効を更新" })
    @ApiBearerAuth()
    async updateSummarySetting(
        @SupabaseUser() user: User,
        @Body() body: { enabled: boolean },
    ) {
        if (typeof body?.enabled !== "boolean") {
            throw new BadRequestException("enabled must be boolean");
        }
        // summary_enabled更新。無効化時はpodcastも無効に。
        await this.domainConfigService.updateSummaryEnabled(
            user.id,
            body.enabled,
        );
        await this.jobsService.rescheduleUserRepeatableJobs(user.id);
        const base = await this.userSettingsRepo.getByUserId(user.id);
        return base;
    }

    @Put("settings/podcast")
    @ApiOperation({
        summary: "ポッドキャスト設定の更新（有効/無効・時刻・言語）",
    })
    @ApiBearerAuth()
    async updatePodcastSetting(
        @SupabaseUser() user: User,
        @Body()
        body: {
            enabled: boolean;
            time?: string;
            language?: "ja-JP" | "en-US";
        },
    ) {
        if (typeof body?.enabled !== "boolean")
            throw new BadRequestException("enabled must be boolean");
        const settings = await this.userSettingsRepo.getByUserId(user.id);
        if (body.enabled && !settings?.summary_enabled) {
            throw new BadRequestException(
                "Podcast cannot be enabled when summary is disabled",
            );
        }
        const updated = await this.domainConfigService.updatePodcastSettings(
            user.id,
            body.enabled,
            body.time,
            body.language,
        );
        await this.jobsService.rescheduleUserRepeatableJobs(user.id);
        return updated;
    }

    @Post("summaries/run-now")
    @ApiOperation({
        summary: "当日分の要約→台本→ポッドキャストをFlowで即時投入（冪等）",
    })
    @ApiBearerAuth()
    async runSummaryNow(
        @SupabaseUser() user: User,
        @Body() body?: { date?: string },
    ) {
        const dateJst = body?.date ?? this.formatDateJst(new Date());
        const flow = await this.flowOrchestrator.createDailyFlow(
            user.id,
            dateJst,
        );
        return { enqueued: true, flowId: flow.flowId, date: dateJst };
    }

    @Post("podcasts/run-now")
    @ApiOperation({
        summary: "当日要約があればポッドキャスト生成を即時投入（冪等）",
    })
    @ApiBearerAuth()
    async runPodcastNow(@SupabaseUser() user: User) {
        const today = this.formatDateJst(new Date());
        await this.podcastQueue.add(
            "generatePodcastForToday",
            { userId: user.id },
            {
                jobId: `podcast-for-today:${user.id}:${today}`,
                removeOnComplete: true,
                removeOnFail: 5,
            },
        );
        return { enqueued: true };
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
