import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { FlowProducer } from "bullmq";
import { RedisService } from "src/shared/redis/redis.service";

@Injectable()
export class FlowOrchestratorService implements OnApplicationShutdown {
    private readonly logger = new Logger(FlowOrchestratorService.name);
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
                jobId: `summary:${userId}:${dateJst}`,
                removeOnComplete: 5,
                removeOnFail: 10,
            },
            children: [
                {
                    name: "generateScriptForDate",
                    queueName: "script-generate",
                    data: { userId, summaryDate: dateJst },
                    opts: {
                        jobId: `script-by-date:${userId}:${dateJst}`,
                        removeOnComplete: 5,
                        removeOnFail: 10,
                    },
                    children: [
                        {
                            name: "generatePodcastForToday",
                            queueName: "podcastQueue",
                            data: { userId },
                            opts: {
                                jobId: `podcast-for-today:${userId}:${dateJst}`,
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
