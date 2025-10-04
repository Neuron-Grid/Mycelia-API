import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import type { PaginatedResult } from "@/common/interfaces/paginated-result.interface";
import { SubscriptionRepository } from "@/feed/infrastructure/subscription.repository";
import { FeedQueueService } from "@/feed/queue/feed-queue.service";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import type { Database } from "@/types/schema";
import type {
    IntervalDto,
    UpdateSubscriptionIntervalDto,
} from "./dto/subscription-interval.dto";
import type { UpdateSubscriptionDto } from "./dto/update-subscription.dto";

type Row = Database["public"]["Tables"]["user_subscriptions"]["Row"];

@Injectable()
export class SubscriptionService {
    private readonly logger = new Logger(SubscriptionService.name);

    constructor(
        private readonly repo: SubscriptionRepository,
        private readonly feedQueueService: FeedQueueService,
        private readonly userSettingsRepository: UserSettingsRepository,
    ) {}

    // ページネーション付き一覧
    async getSubscriptionsPaginated(
        userId: string,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<Row>> {
        return await this.repo.findByUserIdPaginated(userId, page, limit);
    }

    // 単一購読をIDで取得
    // 存在しない場合はnull
    async getSubscriptionById(userId: string, subId: number) {
        return await this.repo.findOne(subId, userId);
    }

    // next_fetch_at ≤ cutoffの購読を取得
    async findDueSubscriptions(cutoff: Date) {
        return await this.repo.findDueSubscriptions(cutoff);
    }

    // 購読を追加（間隔設定付き）
    async addSubscription(
        userId: string,
        feedUrl: string,
        feedTitle: string,
        updateInterval?: IntervalDto,
    ) {
        // URLの妥当性チェック
        if (!this.isValidFeedUrl(feedUrl)) {
            throw new BadRequestException("Invalid feed URL format");
        }

        // 更新間隔の検証
        if (updateInterval && !updateInterval.isValidInterval()) {
            throw new BadRequestException(
                "Invalid update interval: must be between 5 minutes and 24 hours",
            );
        }

        return await this.repo.insertSubscription(userId, feedUrl, feedTitle);
    }

    // フィード取得完了を記録
    // last_fetched_at のみ更新
    async markFetched(subId: number, userId: string, fetchedAt: Date) {
        await this.repo.updateLastFetched(subId, userId, fetchedAt);
    }

    // feed_titleのみ更新
    async updateSubscription(
        userId: string,
        subId: number,
        dto: UpdateSubscriptionDto,
    ) {
        const sub = await this.repo.findOne(subId, userId);
        if (!sub) {
            throw new Error(
                `Subscription not found (id=${subId}, user=${userId})`,
            );
        }
        return await this.repo.updateSubscriptionTitle(
            subId,
            userId,
            dto.feedTitle,
        );
    }

    // 購読を削除
    async deleteSubscription(userId: string, subId: number) {
        const sub = await this.repo.findOne(subId, userId);
        if (!sub) {
            throw new Error(
                `Subscription not found (id=${subId}, user=${userId})`,
            );
        }
        await this.repo.deleteSubscription(subId, userId);
    }

    // 更新間隔の変更
    async updateSubscriptionInterval(
        userId: string,
        subId: number,
        intervalDto: UpdateSubscriptionIntervalDto,
    ) {
        if (!intervalDto.isValid()) {
            throw new BadRequestException(intervalDto.getValidationMessage());
        }

        const sub = await this.repo.findOne(subId, userId);
        if (!sub) {
            throw new NotFoundException(
                `Subscription not found (id=${subId}, user=${userId})`,
            );
        }

        const interval = intervalDto.interval;
        const intervalLabel = interval.toHumanReadable();
        this.logger.log(
            `Updating subscription ${subId} interval for user ${userId}: ${intervalLabel}`,
        );

        const intervalMinutes = interval.getTotalMinutes();
        const nextFetchAt = this.calculateNextFetchAt(sub, intervalMinutes);
        const intervalForPostgres = interval.toPostgresInterval();

        await this.userSettingsRepository.upsertRefreshInterval(
            userId,
            intervalForPostgres,
        );

        this.logger.debug(
            `Persisted refresh interval ${intervalForPostgres} for user ${userId}`,
        );

        return await this.repo.updateNextFetchAt(subId, userId, nextFetchAt);
    }

    // フィードの手動更新
    async refreshSubscription(userId: string, subId: number) {
        this.logger.log(
            `Manually refreshing subscription ${subId} for user ${userId}`,
        );

        const sub = await this.repo.findOne(subId, userId);
        if (!sub) {
            throw new NotFoundException(
                `Subscription not found (id=${subId}, user=${userId})`,
            );
        }

        const { jobId } = await this.feedQueueService.addFeedJob(
            subId,
            userId,
            sub.feed_url,
            sub.feed_title ?? "Unknown Feed",
        );

        const updated = await this.repo.updateNextFetchAt(
            subId,
            userId,
            new Date(),
        );

        return {
            message: "Subscription refresh enqueued",
            jobId,
            nextFetchAt: updated.next_fetch_at,
        };
    }

    // ユーザー固有の期限到達サブスクリプション取得
    async findUserDueSubscriptions(userId: string, cutoff: Date) {
        return await this.repo.findDueSubscriptionsByUser(userId, cutoff);
    }

    private calculateNextFetchAt(sub: Row, intervalMinutes: number): Date {
        const intervalMs = intervalMinutes * 60_000;
        const reference = sub.last_fetched_at
            ? new Date(sub.last_fetched_at)
            : new Date();
        const candidate = new Date(reference.getTime() + intervalMs);
        const now = Date.now();
        return new Date(Math.max(candidate.getTime(), now));
    }

    // プライベートメソッド: URL検証
    private isValidFeedUrl(url: string): boolean {
        try {
            const parsedUrl = new URL(url);
            return ["http:", "https:"].includes(parsedUrl.protocol);
        } catch {
            return false;
        }
    }
}
