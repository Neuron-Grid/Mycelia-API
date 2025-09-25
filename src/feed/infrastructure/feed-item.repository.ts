import { Injectable, Logger } from "@nestjs/common";
import { PaginatedResult } from "@/common/interfaces/paginated-result.interface";
import { SupabaseRequestService } from "@/supabase-request.service";
import type { FeedItemsInsertWithoutHash } from "@/types/overrides";
import { Database, TablesInsert } from "@/types/schema";

type Row = Database["public"]["Tables"]["feed_items"]["Row"];

/**
 * DBトリガー`trg_feed_items_link_hash`がlink_hashを生成するため、
 * Insertペイロードからは除外する。
 * 仕様: canonical_urlがあれば正規化に使用し、無い場合はlinkをtrim→lower→UTF-8→SHA256→hex変換。
 */
type FeedItemInsertPayload = Omit<
    FeedItemsInsertWithoutHash,
    "published_at"
> & {
    published_at: Date | string | null;
};

@Injectable()
export class FeedItemRepository {
    private readonly logger = new Logger(FeedItemRepository.name);

    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
    ) {}

    // ページネーション付き取得
    async findBySubscriptionIdPaginated(
        subscriptionId: number,
        userId: string,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<Row>> {
        const supabase = this.supabaseRequestService.getClient();
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from("feed_items")
            .select("*", { count: "exact" })
            .eq("user_subscription_id", subscriptionId)
            .eq("user_id", userId)
            .eq("soft_deleted", false)
            .order("published_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.logger.error(
                `findBySubscriptionIdPaginated: ${error.message}`,
                error,
            );
            throw error;
        }

        const retrieved = data ?? [];
        const total = count ?? 0;

        return {
            data: retrieved,
            total,
            page,
            limit,
            hasNext: total > offset + retrieved.length,
        };
    }

    // アイテムを追加
    async insertFeedItem(item: FeedItemInsertPayload) {
        const supabase = this.supabaseRequestService.getClient();
        const publishedAt =
            item.published_at === null
                ? null
                : item.published_at instanceof Date
                  ? item.published_at.toISOString()
                  : item.published_at;
        const payload = {
            ...item,
            published_at: publishedAt,
        } satisfies Omit<TablesInsert<"feed_items">, "link_hash">;
        const { error } = await supabase
            .from("feed_items")
            // Supabase型はlink_hash必須だが、トリガーで付与されるため明示的に除外する。
            .insert(payload as unknown as TablesInsert<"feed_items">);

        return error;
    }
}
