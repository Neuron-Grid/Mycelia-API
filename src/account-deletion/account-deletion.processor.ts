import { getQueueToken, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { AccountDeletionService } from "@/account-deletion/account-deletion.service";

@Processor("accountDeletionQueue")
@Injectable()
export class AccountDeletionQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(AccountDeletionQueueProcessor.name);

    @Inject(getQueueToken("accountDeletionQueue"))
    private readonly queue!: Queue;

    constructor(private readonly deletion: AccountDeletionService) {
        super();
    }

    async process(job: Job) {
        switch (job.name) {
            case "aggregateDeletion":
                return await this.handleAggregateDeletion();
            case "deleteUser": {
                const { userId } = job.data as { userId: string };
                return await this.deletion.deleteUserCompletely(userId);
            }
            default:
                this.logger.warn(`Unknown job: ${job.name}`);
                return { ok: true };
        }
    }

    private async handleAggregateDeletion() {
        const candidates = await this.deletion.listDeletionCandidates();
        if (!candidates.length) {
            this.logger.log("No deletion candidates this cycle");
            return { scheduled: 0 };
        }

        // 100件ずつに分割して投入（小さな遅延ジッターで分散）
        const batchSize = 100;
        let scheduled = 0;
        for (let i = 0; i < candidates.length; i += batchSize) {
            const chunk = candidates.slice(i, i + batchSize);
            await this.queue.addBulk(
                chunk.map((userId) => ({
                    name: "deleteUser",
                    data: { userId },
                    opts: {
                        jobId: `deleteUser:${userId}`,
                        delay: (i % 5) * 1_000, // 0-4秒程度のジッター
                        removeOnComplete: true,
                        removeOnFail: 10,
                    },
                })),
            );
            scheduled += chunk.length;
        }

        this.logger.log(`Scheduled deletion jobs: ${scheduled}`);
        return { scheduled };
    }
}
