// @file フィードアイテムの取得・登録を行うサービス
import { Injectable, Logger } from "@nestjs/common";
// @see src/common/interfaces/paginated-result.interface
import { PaginatedResult } from "src/common/interfaces/paginated-result.interface";
// @see src/types/schema
import { Database } from "src/types/schema";
// @see ../infrastructure/feed-item.repository
import { FeedItemRepository } from "../infrastructure/feed-item.repository";

// @typedef {Database['public']['Tables']['feed_items']['Row']} Row - フィードアイテムの型
type Row = Database["public"]["Tables"]["feed_items"]["Row"];

@Injectable()
// @public
// @since 1.0.0
export class FeedItemService {
    // @type {Logger}
    // @readonly
    // @private
    // @default new Logger(FeedItemService.name)
    private readonly logger = new Logger(FeedItemService.name);

    // @param {FeedItemRepository} feedItemRepo - フィードアイテムリポジトリ
    // @since 1.0.0
    // @public
    constructor(private readonly feedItemRepo: FeedItemRepository) {}

    // @async
    // @public
    // @since 1.0.0
    // @param {string} userId - ユーザーID
    // @param {number} subscriptionId - サブスクリプションID
    // @param {number} page - ページ番号
    // @param {number} limit - 1ページあたりの件数
    // @returns {Promise<PaginatedResult<Row>>} - ページネーション付きフィードアイテム
    // @throws {Error} - データ取得に失敗した場合
    // @example
    // const items = await feedItemService.getFeedItemsPaginated('user1', 2, 1, 10)
    // @see FeedItemRepository.findBySubscriptionIdPaginated
    async getFeedItemsPaginated(
        userId: string,
        subscriptionId: number,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<Row>> {
        return await this.feedItemRepo.findBySubscriptionIdPaginated(
            subscriptionId,
            userId,
            page,
            limit,
        );
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {number} subscriptionId - サブスクリプションID
    // @param {string} userId - ユーザーID
    // @param {string} title - タイトル
    // @param {string} link - リンク
    // @param {string} description - 説明
    // @param {Date|null} publishedAt - 公開日時
    // @returns {Promise<unknown>} - 登録結果
    // @throws {Error} - 登録に失敗した場合
    // @example
    // await feedItemService.insertFeedItem(1, 'user1', 'タイトル', 'http://example.com', '説明', new Date())
    // @see FeedItemRepository.insertFeedItem
    async insertFeedItem(
        subscriptionId: number,
        userId: string,
        title: string,
        link: string,
        description: string,
        publishedAt: Date | null,
    ) {
        return await this.feedItemRepo.insertFeedItem({
            user_subscription_id: subscriptionId,
            user_id: userId,
            title,
            link,
            description,
            published_at: publishedAt,
        });
    }
}
