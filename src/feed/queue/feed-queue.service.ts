import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Queue } from 'bullmq'

@Injectable()
export class FeedQueueService {
    constructor(@InjectQueue('feedQueue') private readonly feedQueue: Queue) {}

    // Bullキューにジョブを投入する
    // @param subscriptionId ユーザ購読ID
    // @param userId ユーザID
    async addFeedJob(subscriptionId: number, userId: string) {
        await this.feedQueue.add(
            // job name
            // required by BullMQ
            'default', 
            // job data
            { subscriptionId, userId },
            {
                removeOnComplete: true,
                removeOnFail: false,
                // retry up to 5 times
                attempts: 5,
                // retry after 60s
                backoff: { type: 'fixed', delay: 60_000 },
            },
        )
    }
}
