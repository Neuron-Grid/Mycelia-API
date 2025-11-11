import {
    Injectable,
    Logger,
    OnApplicationShutdown,
    OnModuleInit,
} from "@nestjs/common";
import { Queue, QueueEvents } from "bullmq";
import { IS_WORKER_APP } from "@/config/runtime.constants";
import { RedisService } from "@/shared/redis/redis.service";

type FailedEventPayload = {
    jobId: string;
    failedReason: string;
    prev?: string;
    stacktrace?: string[];
};

type CompletedEventPayload = {
    jobId: string;
    returnvalue: string;
    prev?: string;
};

type QueueMetricState = {
    failedTotal: number;
    completedTotal: number;
    lastFailedAt?: number;
    lastCompletedAt?: number;
};

const METRICS_REDIS_KEY = "metrics:bullmq:prometheus";
const SNAPSHOT_REFRESH_MS = 15_000;
const API_SNAPSHOT_CACHE_TTL_MS = SNAPSHOT_REFRESH_MS * 2;
type RedisClient = ReturnType<RedisService["createMainClient"]>;

const SUPERVISED_QUEUES: readonly string[] = [
    "feedQueue",
    "maintenanceQueue",
    "embeddingQueue",
    "podcastQueue",
    "summary-generate",
    "script-generate",
    "accountDeletionQueue",
];

@Injectable()
export class BullmqSupervisorService
    implements OnModuleInit, OnApplicationShutdown
{
    private readonly logger = new Logger(BullmqSupervisorService.name);
    private readonly events = new Map<string, QueueEvents>();
    private readonly queues = new Map<string, Queue>();
    private readonly metrics = new Map<string, QueueMetricState>();
    private readonly redisClient: RedisClient;
    private latestSnapshot = "";
    private snapshotTimer?: NodeJS.Timeout;
    private lastApiSnapshotLoadedAt = 0;

    constructor(private readonly redisService: RedisService) {
        this.redisClient = this.redisService.createMainClient();
    }

    async onModuleInit(): Promise<void> {
        if (!IS_WORKER_APP) {
            this.logger.log(
                "BullmqSupervisorService initialized in API role (read-only metrics consumer)",
            );
            return;
        }

        await Promise.all(
            SUPERVISED_QUEUES.map((queueName) =>
                this.registerQueueArtifacts(queueName),
            ),
        );

        await this.refreshSnapshot();
        this.snapshotTimer = setInterval(
            () => void this.refreshSnapshot(),
            SNAPSHOT_REFRESH_MS,
        );
    }

    private async registerQueueArtifacts(queueName: string): Promise<void> {
        try {
            const events = new QueueEvents(queueName, {
                connection: this.redisService.createBullClient("subscriber"),
            });
            // QueueSchedulerはBullMQ v5で内部化されたため QueueEvents 監視のみを提供
            events.on("failed", (event: FailedEventPayload) => {
                const metrics = this.ensureMetrics(queueName);
                metrics.failedTotal += 1;
                metrics.lastFailedAt = Date.now();
                this.logger.warn(
                    `[${queueName}] job ${event.jobId} failed: ${event.failedReason ?? event.stacktrace?.[0] ?? "unknown"}`,
                );
            });
            events.on("completed", (event: CompletedEventPayload) => {
                const metrics = this.ensureMetrics(queueName);
                metrics.completedTotal += 1;
                metrics.lastCompletedAt = Date.now();
                this.logger.debug(
                    `[${queueName}] job ${event.jobId} completed (prev=${event.prev ?? "n/a"})`,
                );
            });
            events.on("error", (error: Error) => {
                this.logger.error(
                    `[${queueName}] QueueEvents error: ${error.message}`,
                );
            });
            await events.waitUntilReady();
            this.events.set(queueName, events);

            this.logger.log(`QueueEvents ready for ${queueName}`);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to initialize queue instrumentation for ${queueName}: ${message}`,
            );
        }
    }

    private ensureMetrics(queueName: string): QueueMetricState {
        let metrics = this.metrics.get(queueName);
        if (!metrics) {
            metrics = { failedTotal: 0, completedTotal: 0 };
            this.metrics.set(queueName, metrics);
        }
        return metrics;
    }

    private getOrCreateQueue(queueName: string): Queue {
        const existing = this.queues.get(queueName);
        if (existing) return existing;
        const queue = new Queue(queueName, {
            connection: this.redisService.createBullClient("client"),
        });
        this.queues.set(queueName, queue);
        return queue;
    }

    private async refreshSnapshot(): Promise<void> {
        const snapshot = await this.buildPrometheusDocument();
        this.latestSnapshot = snapshot;
        try {
            await (
                this.redisClient as { set?: (...args: unknown[]) => unknown }
            ).set?.(
                METRICS_REDIS_KEY,
                snapshot,
                "EX",
                Math.ceil(SNAPSHOT_REFRESH_MS / 1000) * 3,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to persist metrics snapshot: ${message}`);
        }
    }

    async getPrometheusSnapshot(): Promise<string> {
        if (IS_WORKER_APP) {
            if (!this.latestSnapshot) {
                await this.refreshSnapshot();
            }
            return this.latestSnapshot;
        }

        const shouldReload =
            !this.latestSnapshot ||
            Date.now() - this.lastApiSnapshotLoadedAt >=
                API_SNAPSHOT_CACHE_TTL_MS;
        if (shouldReload) {
            await this.loadSnapshotFromRedis();
        }
        return (
            this.latestSnapshot ||
            "# HELP bullmq_metrics_available Flag indicating metrics presence\n" +
                "# TYPE bullmq_metrics_available gauge\n" +
                "bullmq_metrics_available 0\n"
        );
    }

    private async loadSnapshotFromRedis(): Promise<void> {
        try {
            const cached = await (
                this.redisClient as {
                    get?: (...args: unknown[]) => Promise<string | null>;
                }
            ).get?.(METRICS_REDIS_KEY);
            if (cached) {
                this.latestSnapshot = cached;
                this.lastApiSnapshotLoadedAt = Date.now();
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to load metrics snapshot: ${message}`);
        }
    }

    private async buildPrometheusDocument(): Promise<string> {
        const lines: string[] = [];
        lines.push(
            "# HELP bullmq_queue_failed_total Total failed jobs observed per queue",
        );
        lines.push("# TYPE bullmq_queue_failed_total counter");
        lines.push(
            "# HELP bullmq_queue_completed_total Total completed jobs observed per queue",
        );
        lines.push("# TYPE bullmq_queue_completed_total counter");
        lines.push(
            "# HELP bullmq_queue_last_failed_timestamp_seconds Unix timestamp of the last observed failure per queue",
        );
        lines.push("# TYPE bullmq_queue_last_failed_timestamp_seconds gauge");
        lines.push(
            "# HELP bullmq_queue_last_completed_timestamp_seconds Unix timestamp of the last observed completion per queue",
        );
        lines.push(
            "# TYPE bullmq_queue_last_completed_timestamp_seconds gauge",
        );
        lines.push(
            "# HELP bullmq_queue_jobs Count of jobs per queue and state (waiting, active, delayed, completed, failed)",
        );
        lines.push("# TYPE bullmq_queue_jobs gauge");

        const nowSeconds = Math.floor(Date.now() / 1000);
        for (const queueName of SUPERVISED_QUEUES) {
            const metrics = this.ensureMetrics(queueName);
            lines.push(
                `bullmq_queue_failed_total{queue="${queueName}"} ${metrics.failedTotal}`,
            );
            lines.push(
                `bullmq_queue_completed_total{queue="${queueName}"} ${metrics.completedTotal}`,
            );
            lines.push(
                `bullmq_queue_last_failed_timestamp_seconds{queue="${queueName}"} ${metrics.lastFailedAt ? Math.floor(metrics.lastFailedAt / 1000) : 0}`,
            );
            lines.push(
                `bullmq_queue_last_completed_timestamp_seconds{queue="${queueName}"} ${metrics.lastCompletedAt ? Math.floor(metrics.lastCompletedAt / 1000) : 0}`,
            );

            const counts = await this.getQueueJobCounts(queueName);
            for (const [state, value] of Object.entries(counts)) {
                lines.push(
                    `bullmq_queue_jobs{queue="${queueName}",state="${state}"} ${value}`,
                );
            }
        }

        lines.push(
            "# HELP bullmq_metrics_last_refresh_seconds Unix timestamp of the latest snapshot refresh",
        );
        lines.push("# TYPE bullmq_metrics_last_refresh_seconds gauge");
        lines.push(`bullmq_metrics_last_refresh_seconds ${nowSeconds}`);
        return `${lines.join("\n")}\n`;
    }

    private async getQueueJobCounts(
        queueName: string,
    ): Promise<Record<string, number>> {
        try {
            const queue = this.getOrCreateQueue(queueName);
            const counts = await queue.getJobCounts();
            return {
                waiting: counts.waiting ?? 0,
                active: counts.active ?? 0,
                delayed: counts.delayed ?? 0,
                completed: counts.completed ?? 0,
                failed: counts.failed ?? 0,
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `Failed to fetch job counts for ${queueName}: ${message}`,
            );
            return {
                waiting: 0,
                active: 0,
                delayed: 0,
                completed: 0,
                failed: 0,
            };
        }
    }

    async onApplicationShutdown(): Promise<void> {
        if (this.snapshotTimer) {
            clearInterval(this.snapshotTimer);
        }
        const closers: Promise<unknown>[] = [];
        for (const events of this.events.values()) {
            closers.push(
                events.close().catch((error) => {
                    const message =
                        error instanceof Error ? error.message : String(error);
                    this.logger.error(
                        `Failed to close QueueEvents: ${message}`,
                    );
                }),
            );
        }
        for (const queue of this.queues.values()) {
            closers.push(
                queue.close().catch((error) => {
                    const message =
                        error instanceof Error ? error.message : String(error);
                    this.logger.error(
                        `Failed to close Queue inspector: ${message}`,
                    );
                }),
            );
        }
        const redisQuit = (
            this.redisClient as {
                quit?: () => Promise<unknown>;
            }
        ).quit;
        if (redisQuit) {
            closers.push(
                redisQuit.call(this.redisClient).catch((error: unknown) => {
                    const message =
                        error instanceof Error ? error.message : String(error);
                    this.logger.warn(
                        `Failed to close metrics Redis client: ${message}`,
                    );
                }),
            );
        }
        await Promise.all(closers);
        this.events.clear();
        this.queues.clear();
        this.metrics.clear();
    }
}
