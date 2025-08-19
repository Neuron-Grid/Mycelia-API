import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { validateDto } from "@/common/utils/validation";
import { FeedFetchJobDto } from "./dto/feed-fetch-job.dto";

@Injectable()
export class FeedQueueService {
    constructor(@InjectQueue("feedQueue") private readonly feedQueue: Queue) {}

    // Bullキューにジョブを投入する
    // @param subscriptionId ユーザ購読ID
    // @param userId ユーザID
    async addFeedJob(
        subscriptionId: number,
        userId: string,
        feedUrl = "",
        feedTitle = "Unknown Feed",
    ) {
        // DTO に詰めてバリデーション
        const dto = await validateDto(FeedFetchJobDto, {
            subscriptionId,
            userId,
            feedUrl,
            feedTitle,
        });

        await this.feedQueue.add("default", dto, {
            removeOnComplete: true,
            // 失敗ジョブは一定数保持（デバッグ用）
            removeOnFail: 20,
            attempts: 5,
            backoff: { type: "fixed", delay: 60_000 },
            jobId: `feed-${dto.subscriptionId}`,
        });
    }
}
