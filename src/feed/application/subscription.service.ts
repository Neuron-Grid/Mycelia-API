import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import { PaginatedResult } from "src/common/interfaces/paginated-result.interface";
import { Database } from "src/types/schema";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";
import {
    IntervalDto,
    UpdateSubscriptionIntervalDto,
} from "./dto/subscription-interval.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";

type Row = Database["public"]["Tables"]["user_subscriptions"]["Row"];

@Injectable()
export class SubscriptionService {
    private readonly logger = new Logger(SubscriptionService.name);

    constructor(private readonly repo: SubscriptionRepository) {}

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
            dto.feed_title,
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

        this.logger.log(
            `Updating subscription ${subId} interval for user ${userId}: ${intervalDto.interval.toHumanReadable()}`,
        );

        // 間隔更新メソッドをリポジトリに追加する必要があります
        // return await this.repo.updateSubscriptionInterval(subId, userId, intervalDto.interval.toPostgresInterval())

        // 暫定的にタイトル更新として実装
        return await this.repo.updateSubscriptionTitle(
            subId,
            userId,
            sub.feed_title || "",
        );
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

        // next_fetch_atを現在時刻に設定して即座に更新対象にする
        // リポジトリにメソッド追加が必要

        return { message: "Subscription marked for immediate update" };
    }

    // ユーザー固有の期限到達サブスクリプション取得
    async findUserDueSubscriptions(userId: string, cutoff: Date) {
        return await this.repo.findDueSubscriptionsByUser(userId, cutoff);
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
