import { Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { FeedUseCaseService } from '../application/feed-usecase.service'

// キュー名: 'feedQueue'
// 購読ID & ユーザID を受け取り、RSSを取得してDB更新する
@Processor('feedQueue')
export class FeedQueueProcessor {
    private readonly logger = new Logger(FeedQueueProcessor.name)

    constructor(private readonly feedUseCaseService: FeedUseCaseService) {}

    // "default"ジョブを処理する
    // 例: job.data = { subscriptionId: 123, userId: 'uuid-xxx' }
    @Process()
    async handleFeedJob(job: Job) {
        const { subscriptionId, userId } = job.data
        this.logger.debug(`Start processing feed job: sub=${subscriptionId}, user=${userId}`)
        try {
            const result = await this.feedUseCaseService.fetchFeedItems(subscriptionId, userId)
            this.logger.log(
                `Feed processed: sub=${subscriptionId}, user=${userId}, inserted=${result.insertedCount}`,
            )
            return result
        } catch (error) {
            this.logger.error(`Failed to process sub=${subscriptionId}, user=${userId}: ${error}`)
            throw error
        }
    }
}
