import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { validateDto } from "src/common/utils/validation";
import { FeedUseCaseService } from "../application/feed-usecase.service";
import { FeedFetchJobDto } from "./dto/feed-fetch-job.dto";

// キュー名: 'feedQueue'
// 購読ID + ユーザIDを受け取り、RSSを取得してDB更新する
@Processor("feedQueue")
export class FeedQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(FeedQueueProcessor.name);

    constructor(private readonly feedUseCaseService: FeedUseCaseService) {
        super();
    }

    // "default"ジョブを処理する
    // 例: job.data = { subscriptionId: 123, userId: 'uuid-xxx' }
    async process(job: Job<FeedFetchJobDto>) {
        // DTO バリデーション – 破損データを早期検出
        await validateDto(FeedFetchJobDto, job.data);
        const { subscriptionId, userId } = job.data;
        this.logger.debug(
            `Start processing feed job: sub=${subscriptionId}, user=${userId}`,
        );
        try {
            const result = await this.feedUseCaseService.fetchFeedItems(
                subscriptionId,
                userId,
            );
            this.logger.log(
                `Feed processed: sub=${subscriptionId}, user=${userId}, inserted=${result.insertedCount}`,
            );
            return result;
        } catch (error) {
            this.logger.error(
                `Failed to process sub=${subscriptionId}, user=${userId}: ${error}`,
            );
            throw error;
        }
    }
}
