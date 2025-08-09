import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { PodcastGenerationJobDto } from "src/podcast/queue/dto/podcast-generation-job.dto";

@Injectable()
export class PodcastQueueService {
    private readonly logger = new Logger(PodcastQueueService.name);

    constructor(
        @InjectQueue("podcastQueue") private readonly podcastQueue: Queue,
    ) {}

    // 旧API（非推奨）: 互換のため残置
    async addPodcastJobDeprecated(
        _text: string,
        userId: string,
        _language: "ja-JP" | "en-US" = "ja-JP",
        _filename?: string,
        _title?: string,
    ) {
        this.logger.warn(
            "addPodcastJobDeprecated は非推奨です。generatePodcast を使用してください",
        );
        // today用のジョブを投入（サマリ存在時のみ実行される）
        await this.addGeneratePodcastForTodayJob(userId);
        return { deprecated: true } as const;
    }

    // 要約IDを指定してポッドキャスト生成を投入
    async addGeneratePodcastJob(userId: string, summaryId: number) {
        const payload: PodcastGenerationJobDto = { userId, summaryId };
        await this.podcastQueue.add("generatePodcast", payload, {
            removeOnComplete: true,
            removeOnFail: false,
            attempts: 3,
            backoff: { type: "fixed", delay: 30_000 },
            jobId: `podcast:${userId}:${summaryId}`,
        });
        this.logger.log(
            `Queued generatePodcast job: userId=${userId}, summaryId=${summaryId}`,
        );
    }

    // 当日要約に基づいてポッドキャスト生成（スケジュール用途）
    async addGeneratePodcastForTodayJob(userId: string) {
        await this.podcastQueue.add(
            "generatePodcastForToday",
            { userId },
            {
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 3,
                backoff: { type: "fixed", delay: 30_000 },
                jobId: `podcast-today:${userId}`,
            },
        );
        this.logger.log(`Queued generatePodcastForToday job: userId=${userId}`);
    }
}
