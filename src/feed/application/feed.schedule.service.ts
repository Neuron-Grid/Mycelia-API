import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { FeedQueueService } from "../queue/feed-queue.service";
import { SubscriptionService } from "./subscription.service";

// next_fetch_at ≤ 現在時刻 の購読を1分おきにまとめてキューへ投入する
@Injectable()
export class FeedScheduleService {
    private readonly logger = new Logger(FeedScheduleService.name);

    constructor(
        private readonly subscriptionService: SubscriptionService,
        private readonly feedQueueService: FeedQueueService,
    ) {}

    // 毎分0秒に実行
    @Cron("0 * * * * *")
    async enqueueDueSubscriptions(): Promise<void> {
        const now = new Date();

        const subs = await this.subscriptionService.findDueSubscriptions(now);
        if (subs.length === 0) {
            this.logger.debug("No subscriptions due");
            return;
        }

        for (const s of subs) {
            await this.feedQueueService.addFeedJob(
                s.id,
                s.user_id,
                s.feed_url,
                s.feed_title || "Unknown Feed",
            );
        }
        this.logger.log(
            `Enqueued ${subs.length} job(s) (<= ${now.toISOString()})`,
        );
    }
}
