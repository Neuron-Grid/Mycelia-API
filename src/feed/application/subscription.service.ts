import { Injectable, Logger } from '@nestjs/common'
import { Database } from 'src/types/schema'
import { SubscriptionRepository } from '../infrastructure/subscription.repository'
import { UpdateSubscriptionDto } from './dto/update-subscription.dto'

@Injectable()
export class SubscriptionService {
    private readonly logger = new Logger(SubscriptionService.name)

    constructor(private readonly subscriptionRepo: SubscriptionRepository) {}

    async getSubscriptionsByUserId(userId: string) {
        return await this.subscriptionRepo.findByUserId(userId)
    }

    async addSubscription(userId: string, feedUrl: string, feedTitle: string) {
        return await this.subscriptionRepo.insertSubscription(userId, feedUrl, feedTitle)
    }

    async getSubscriptionById(userId: string, subscriptionId: number) {
        return await this.subscriptionRepo.findOne(subscriptionId, userId)
    }

    async updateFetchTimestamps(subscriptionId: number, userId: string, last: Date, next: Date) {
        return await this.subscriptionRepo.updateFetchTimestamps(subscriptionId, userId, last, next)
    }

    // refresh_interval 別に購読を取得
    async findByInterval(interval: Database['public']['Enums']['refresh_interval_enum']) {
        return await this.subscriptionRepo.findByRefreshInterval(interval)
    }

    // 購読情報を更新
    async updateSubscription(userId: string, subscriptionId: number, dto: UpdateSubscriptionDto) {
        // まず購読が存在するかチェック
        const subscription = await this.subscriptionRepo.findOne(subscriptionId, userId)
        if (!subscription) {
            throw new Error(`Subscription not found (id=${subscriptionId}, user=${userId})`)
        }

        // RepositoryでDB更新
        return await this.subscriptionRepo.updateSubscription(subscriptionId, userId, {
            refresh_interval: dto.refresh_interval,
            feed_title: dto.feed_title,
        })
    }

    // 購読を削除
    async deleteSubscription(userId: string, subscriptionId: number) {
        // 存在チェック
        const subscription = await this.subscriptionRepo.findOne(subscriptionId, userId)
        if (!subscription) {
            throw new Error(`Subscription not found (id=${subscriptionId}, user=${userId})`)
        }

        // ここが Repository 側に実装されていればOK
        await this.subscriptionRepo.deleteSubscription(subscriptionId, userId)
    }
}
