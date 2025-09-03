// @file システムヘルスチェックAPIのコントローラ

import { TypedRoute } from "@nestia/core";
import { InjectQueue } from "@nestjs/bullmq";
import { Controller } from "@nestjs/common";
// @see https://docs.bullmq.io/
import { Job, Queue } from "bullmq";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import { RedisService } from "@/shared/redis/redis.service";
import { SupabaseRequestService } from "@/supabase-request.service";
import type { HealthCheckResponseDto } from "./dto/health-check-response.dto";
import { JobCountsDto } from "./dto/health-check-response.dto";

// BullMQ の戻り値用
// Swagger DTOとは別物
// @typedef {Awaited<ReturnType<Queue['getJobCounts']>>} RawJobCounts - BullMQジョブカウント型
type RawJobCounts = Awaited<ReturnType<Queue["getJobCounts"]>>;

@Controller("health")
// @public
// @since 1.0.0
export class HealthController {
    // @type {number}
    // @readonly
    // @private
    // @default 5000
    private readonly TIMEOUT_MS = 5000;

    // @param {SupabaseRequestService} supabaseRequestService - Supabaseリクエストサービス
    // @param {Queue} feedQueue - BullMQキュー
    // @param {RedisService} redisService - Redisサービス
    // @since 1.0.0
    // @public
    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        @InjectQueue("feedQueue") private readonly feedQueue: Queue,
        @InjectQueue("embeddingQueue") private readonly embeddingQueue: Queue,
        @InjectQueue("summary-generate")
        private readonly summaryQueue: Queue,
        @InjectQueue("script-generate") private readonly scriptQueue: Queue,
        @InjectQueue("podcastQueue") private readonly podcastQueue: Queue,
        private readonly redisService: RedisService,
    ) {}

    // @async
    // @public
    // @since 1.0.0
    // @returns {Promise<HealthCheckResponseDto>} - ヘルスチェック結果
    // @throws {HttpException} - チェック失敗時
    // @example
    // await healthController.checkHealth()
    // @see HealthCheckResponseDto
    @TypedRoute.Get("")
    /** Returns health check results */
    async checkHealth(): Promise<SuccessResponse<HealthCheckResponseDto>> {
        await this.checkDatabaseWithTimeout();
        await this.checkRedisWithTimeout();
        const queues = [
            ["feedQueue", this.feedQueue],
            ["embeddingQueue", this.embeddingQueue],
            ["summary-generate", this.summaryQueue],
            ["script-generate", this.scriptQueue],
            ["podcastQueue", this.podcastQueue],
        ] as const;

        const results = await Promise.all(
            queues.map(([name, q]) => this.checkQueueStatsWithTimeout(name, q)),
        );
        const bullStatus = results.every((r) => r.status === "OK")
            ? "OK"
            : "DEGRADED";
        const jobCounts = Object.fromEntries(
            results.map((r) => [r.name, r.counts]),
        ) as unknown as JobCountsDto;

        return buildResponse("Health checked", {
            status: "OK",
            db: "OK",
            bullQueue: { status: bullStatus, jobCounts },
            redis: "OK",
        });
    }
    // @async
    // @private
    // @since 1.0.0
    // @returns {Promise<void>} - DBチェック結果
    // @throws {Error} - DBチェック失敗時
    // @example
    // await healthController['checkDatabaseWithTimeout']()
    // @see SupabaseRequestService.getClient
    private async checkDatabaseWithTimeout(): Promise<void> {
        const supabase = this.supabaseRequestService.getClient();

        await this.withTimeout(
            (async () => {
                const { error } = await supabase
                    .from("users")
                    .select("id")
                    .limit(1);
                if (error) {
                    throw new Error(`Database check failed: ${error.message}`);
                }
            })(),
            this.TIMEOUT_MS,
        );
    }

    // @async
    // @private
    // @since 1.0.0
    // @returns {Promise<void>} - Redisチェック結果
    // @throws {Error} - Redisチェック失敗時
    // @example
    // await healthController['checkRedisWithTimeout']()
    // @see RedisService.createMainClient
    private async checkRedisWithTimeout(): Promise<void> {
        await this.withTimeout(
            (async () => {
                const redisClient = this.redisService.createMainClient();
                const pingResult = await redisClient.ping();
                if (pingResult !== "PONG") {
                    throw new Error(`Unexpected PING result: ${pingResult}`);
                }
            })(),
            this.TIMEOUT_MS,
        );
    }

    // @async
    // @private
    // @since 1.0.0
    // @returns {Promise<{ bullStatus: string, jobCounts: JobCountsDto }>} - BullMQチェック結果
    // @throws {Error} - BullMQチェック失敗時
    // @example
    // await healthController['checkBullQueueWithTimeout']()
    // @see Queue.getJobCounts
    private async checkQueueStatsWithTimeout(
        name: string,
        queue: Queue,
    ): Promise<{
        name: string;
        status: string;
        counts: RawJobCounts & {
            failureRate?: number;
            oldestWaitingMs?: number | null;
        };
    }> {
        let counts: RawJobCounts & {
            failureRate?: number;
            oldestWaitingMs?: number | null;
        } = {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            paused: 0,
        } as RawJobCounts;

        await this.withTimeout(
            (async () => {
                await queue.waitUntilReady();
                const c: RawJobCounts = await queue.getJobCounts();
                counts = { ...counts, ...c };
                const denom = (c.completed || 0) + (c.failed || 0);
                counts.failureRate = denom > 0 ? (c.failed || 0) / denom : 0;

                // 待機中の最古ジョブの滞留時間を概算
                const waitingJobs: Job[] = await queue.getWaiting(0, 0);
                if (waitingJobs.length > 0) {
                    const created = waitingJobs[0].timestamp || Date.now();
                    counts.oldestWaitingMs = Date.now() - created;
                } else {
                    counts.oldestWaitingMs = null;
                }
            })(),
            this.TIMEOUT_MS,
        );

        // 失敗しきい値で通知（ログ代替）: 20%超でDEGRADED扱い
        const status =
            counts.failureRate && counts.failureRate > 0.2 ? "DEGRADED" : "OK";
        return { name, status, counts };
    }

    // @async
    // @private
    // @since 1.0.0
    // @template T
    // @param {Promise<T>} promise - タイムアウトをかけるPromise
    // @param {number} ms - タイムアウト時間（ミリ秒）
    // @returns {Promise<T>} - 結果
    // @throws {Error} - タイムアウト時
    // @example
    // await healthController['withTimeout'](Promise.resolve(1), 1000)
    private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error(`Timeout after ${ms}ms`)),
                ms,
            );

            promise
                .then((res) => {
                    clearTimeout(timer);
                    resolve(res);
                })
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }
}
