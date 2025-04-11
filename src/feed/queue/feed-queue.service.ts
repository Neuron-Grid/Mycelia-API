import { InjectQueue } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { Queue } from 'bull'

@Injectable()
export class FeedQueueService {
    constructor(@InjectQueue('feedQueue') private readonly feedQueue: Queue) {}

    // Bullキューにジョブを投入する
    // @param subscriptionId ユーザ購読ID
    // @param userId ユーザID
    async addFeedJob(subscriptionId: number, userId: string) {
        // 第2引数: jobデータ
        // 第3引数: オプション
        await this.feedQueue.add(
            {
                subscriptionId,
                userId,
            },
            {
                removeOnComplete: true,
                removeOnFail: false,
                // 最大5回リトライ
                attempts: 5,
                // 失敗時1分後に再試行
                backoff: 60_000,
            },
        )
    }
}
