import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { FlowProducer } from "bullmq";
import {
    buildPodcastForTodayJobId,
    buildScriptByDateJobId,
    buildSummaryJobId,
} from "@/common/utils/job-id.util";
import { RedisService } from "@/shared/redis/redis.service";

@Injectable()
export class FlowOrchestratorService implements OnApplicationShutdown {
    // NOTE: Keep a dedicated Logger instance because NestJS lifecycle hooks (`createDailyFlow`, `onApplicationShutdown`) sometimes trigger Biome false positives when decorators are involved.
    private readonly logger = new Logger(FlowOrchestratorService.name);
    // NOTE: FlowProducer wiring remains a private property so Worker/API roles can share orchestration logic without re-instantiating the BullMQ client.
    private readonly flow: FlowProducer;

    constructor(private readonly redisService: RedisService) {
        this.flow = new FlowProducer({
            connection: this.redisService.createBullClient(),
        });
    }

    async createDailyFlow(
        userId: string,
        dateJst: string,
    ): Promise<{ flowId: string }> {
        const tree = {
            name: "generateUserSummary",
            queueName: "summary-generate",
            data: { userId, summaryDate: dateJst },
            opts: {
                jobId: buildSummaryJobId(userId, dateJst),
                removeOnComplete: 5,
                removeOnFail: 10,
            },
            children: [
                {
                    name: "generateScriptForDate",
                    queueName: "script-generate",
                    data: { userId, summaryDate: dateJst },
                    opts: {
                        jobId: buildScriptByDateJobId(userId, dateJst),
                        removeOnComplete: 5,
                        removeOnFail: 10,
                    },
                    children: [
                        {
                            name: "generatePodcastForToday",
                            queueName: "podcastQueue",
                            data: { userId },
                            opts: {
                                jobId: buildPodcastForTodayJobId(
                                    userId,
                                    dateJst,
                                ),
                                removeOnComplete: 5,
                                removeOnFail: 10,
                            },
                        },
                    ],
                },
            ],
        };

        const { job } = await this.flow.add(tree);
        this.logger.log(
            `Created flow for user ${userId} on ${dateJst}: ${job.id}`,
        );
        return { flowId: String(job.id) };
    }

    async onApplicationShutdown() {
        try {
            await this.flow.close();
            this.logger.log("FlowProducer closed gracefully");
        } catch (e) {
            this.logger.warn(
                `Failed to close FlowProducer: ${(e as Error).message}`,
            );
        }
    }
}
