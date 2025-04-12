import { Injectable, Logger } from '@nestjs/common'
import { Database } from 'src/types/schema'
import { SubscriptionRepository } from '../infrastructure/subscription.repository'

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
}
