// @file フィードアイテムの取得・登録を行うサービス
import { Injectable } from "@nestjs/common";
import { PaginatedResult } from "src/common/interfaces/paginated-result.interface";
import { FavoriteRepository } from "src/favorite/infrastructure/favorite.repository";
import { TagRepository } from "src/tag/infrastructure/tag.repository";
import { FeedItemRepository } from "../infrastructure/feed-item.repository";
import { FeedItemResponseDto } from "./dto/feed-item-response.dto";

@Injectable()
// @public
// @since 1.0.0
export class FeedItemService {
    // @param {FeedItemRepository} feedItemRepo - フィードアイテムリポジトリ
    // @since 1.0.0
    // @public
    constructor(
        private readonly feedItemRepo: FeedItemRepository,
        private readonly favoriteRepo: FavoriteRepository,
        private readonly tagRepo: TagRepository,
    ) {}

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
    ): Promise<PaginatedResult<FeedItemResponseDto>> {
        // 1. 基本的なフィードアイテムをページネーションで取得
        const paginatedResult =
            await this.feedItemRepo.findBySubscriptionIdPaginated(
                subscriptionId,
                userId,
                page,
                limit,
            );
        const feedItems = paginatedResult.data;
        if (feedItems.length === 0) {
            return { ...paginatedResult, data: [] };
        }

        const feedItemIds = feedItems.map((item) => item.id);

        // 2. 関連データをIDのリストで一括取得 (N+1問題の回避)
        const [favorites, tagsMap] = await Promise.all([
            this.favoriteRepo.findFavoritesByFeedItemIds(userId, feedItemIds),
            this.tagRepo.findTagsMapByFeedItemIds(userId, feedItemIds),
        ]);

        const favoriteFeedItemIds = new Set(
            favorites.map((fav) => fav.feed_item_id),
        );

        // 3. データをDTOにマッピング
        const responseData = feedItems.map((item) => ({
            ...item,
            isFavorite: favoriteFeedItemIds.has(item.id),
            tags: tagsMap.get(item.id) || [],
        }));

        return {
            ...paginatedResult,
            data: responseData,
        };
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
