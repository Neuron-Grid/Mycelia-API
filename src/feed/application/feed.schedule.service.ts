import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { FeedQueueService } from '../queue/feed-queue.service'
import { SubscriptionService } from './subscription.service'

@Injectable()
export class FeedScheduleService {
    private readonly logger = new Logger(FeedScheduleService.name)

    constructor(
        private readonly subscriptionService: SubscriptionService,
        private readonly feedQueueService: FeedQueueService,
    ) {}

    // 5分おきのCRON
    @Cron('0 */5 * * * *')
    async fetchFor5minute() {
        // DBから "refresh_interval = '5minute'" のレコードだけ取得し、Bullへ投入
        await this.enqueueSubscriptionsByInterval('5minute')
    }

    // 10分おきのCRON
    @Cron('0 */10 * * * *')
    async fetchFor10minute() {
        await this.enqueueSubscriptionsByInterval('10minute')
    }

    // 30分おきのCRON
    @Cron('0 */30 * * * *')
    async fetchFor30minute() {
        await this.enqueueSubscriptionsByInterval('30minute')
    }

    // 1時間おきのCRON
    @Cron('0 0 * * * *')
    async fetchFor1hour() {
        await this.enqueueSubscriptionsByInterval('1hour')
    }

    // 2時間おきのCRON
    @Cron('0 0 */2 * * *')
    async fetchFor2hour() {
        await this.enqueueSubscriptionsByInterval('2hour')
    }

    // 4時間おきのCRON
    @Cron('0 0 */4 * * *')
    async fetchFor4hour() {
        await this.enqueueSubscriptionsByInterval('4hour')
    }

    // 6時間おきのCRON
    @Cron('0 0 */6 * * *')
    async fetchFor6hour() {
        await this.enqueueSubscriptionsByInterval('6hour')
    }

    // 12時間おきのCRON
    @Cron('0 0 */12 * * *')
    async fetchFor12hour() {
        await this.enqueueSubscriptionsByInterval('12hour')
    }

    // 必要に応じて "2hour", "12hour", "1day" など増やす

    // 特定の refresh_interval を持つ購読を全て取得し、
    // Bullへジョブとして登録する共通メソッド
    private async enqueueSubscriptionsByInterval(interval: string) {
        this.logger.debug(`Fetching subscriptions for interval=${interval}`)

        // SubscriptionServiceに実装したfindByInterval(interval)を呼ぶ
        const subscriptions = await this.subscriptionService.findByInterval(interval)
        this.logger.log(`Found ${subscriptions.length} subscription(s) for [${interval}]`)

        // 各購読についてBullキューへジョブ登録
        for (const sub of subscriptions) {
            await this.feedQueueService.addFeedJob(sub.id, sub.user_id)
        }

        this.logger.log(`Enqueued ${subscriptions.length} jobs for interval=[${interval}]`)
    }
}
