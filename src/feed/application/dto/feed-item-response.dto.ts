import type { Database } from "@/types/schema";
import { FeedItemEntity } from "../../domain/feed-item.entity";

type FeedItemRow = Database["public"]["Tables"]["feed_items"]["Row"];

export class FeedItemResponseDto extends FeedItemEntity {
    isFavorite: boolean;
    tags: string[];

    constructor(data: FeedItemRow) {
        // FeedItemEntityのコンストラクタに適切な形式でデータを渡す
        super(data as ConstructorParameters<typeof FeedItemEntity>[0]); // データベース層の文字列日付がEntityで変換される
        // デフォルト値を設定
        this.isFavorite = false;
        this.tags = [];
    }
}
