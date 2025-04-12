import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { Database } from 'src/types/schema'
import { FeedQueueService } from '../queue/feed-queue.service'
import { SubscriptionService } from './subscription.service'

@Injectable()
export class FeedScheduleService {
    private readonly logger = new Logger(FeedScheduleService.name)

    constructor(
        private readonly subscriptionService: SubscriptionService,
        private readonly feedQueueService: FeedQueueService,
    ) {}

    // 5分おき
    @Cron('0 */5 * * * *')
    async fetchFor5minute() {
        await this.enqueueSubscriptionsByInterval('5minute')
    }

    // 10分おき
    @Cron('0 */10 * * * *')
    async fetchFor10minute() {
        await this.enqueueSubscriptionsByInterval('10minute')
    }

    // 30分おき
    @Cron('0 */30 * * * *')
    async fetchFor30minute() {
        await this.enqueueSubscriptionsByInterval('30minute')
    }

    // 1時間おき
    @Cron('0 0 * * * *')
    async fetchFor1hour() {
        await this.enqueueSubscriptionsByInterval('1hour')
    }

    // 2時間おき
    @Cron('0 0 */2 * * *')
    async fetchFor2hour() {
        await this.enqueueSubscriptionsByInterval('2hour')
    }

    // 4時間おき
    @Cron('0 0 */4 * * *')
    async fetchFor4hour() {
        await this.enqueueSubscriptionsByInterval('4hour')
    }

    // 6時間おき
    @Cron('0 0 */6 * * *')
    async fetchFor6hour() {
        await this.enqueueSubscriptionsByInterval('6hour')
    }

    // 12時間おき
    @Cron('0 0 */12 * * *')
    async fetchFor12hour() {
        await this.enqueueSubscriptionsByInterval('12hour')
    }

    // Interval に該当する購読を全部取得してキューに投入
    private async enqueueSubscriptionsByInterval(
        interval: Database['public']['Enums']['refresh_interval_enum'],
    ) {
        this.logger.debug(`Fetching subscriptions for interval=${interval}`)

        const subscriptions = await this.subscriptionService.findByInterval(interval)
        this.logger.log(`Found ${subscriptions.length} subscription(s) for [${interval}]`)

        for (const sub of subscriptions) {
            await this.feedQueueService.addFeedJob(sub.id, sub.user_id)
        }

        this.logger.log(`Enqueued ${subscriptions.length} jobs for interval=[${interval}]`)
    }
}
