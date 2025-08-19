import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { SubscriptionAdminRepository } from "@/feed/infrastructure/subscription-admin.repository";
import { FeedQueueService } from "@/feed/queue/feed-queue.service";

@Processor("feedQueue")
@Injectable()
export class FeedQueueScanProcessor extends WorkerHost {
    private readonly logger = new Logger(FeedQueueScanProcessor.name);

    constructor(
        private readonly adminRepo: SubscriptionAdminRepository,
        private readonly feedQueueService: FeedQueueService,
    ) {
        super();
    }

    async process(job: Job) {
        if (job.name !== "scanDueSubscriptions") {
            this.logger.warn(`Unknown job: ${job.name}`);
            return;
        }
        const now = new Date();
        const due = await this.adminRepo.findDueSubscriptions(now);
        if (due.length === 0) {
            this.logger.debug("No due subscriptions");
            return { enqueued: 0 };
        }
        let enqueued = 0;
        for (const s of due) {
            try {
                await this.feedQueueService.addFeedJob(
                    s.id,
                    s.user_id,
                    s.feed_url,
                    s.feed_title || "Unknown Feed",
                );
                enqueued++;
            } catch (e) {
                this.logger.error(
                    `Failed to enqueue sub=${s.id}, user=${s.user_id}: ${(e as Error).message}`,
                );
            }
        }
        this.logger.log(`Enqueued ${enqueued} job(s) at ${now.toISOString()}`);
        return { enqueued };
    }
}
