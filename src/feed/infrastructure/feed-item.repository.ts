import { Injectable, Logger } from "@nestjs/common";
import { PaginatedResult } from "src/common/interfaces/paginated-result.interface";
import { SupabaseRequestService } from "src/supabase-request.service";
import { Database } from "src/types/schema";

type Row = Database["public"]["Tables"]["feed_items"]["Row"];

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
    async insertFeedItem(item: {
        user_subscription_id: number;
        user_id: string;
        title: string;
        link: string;
        description: string;
        published_at: Date | null;
    }) {
        const supabase = this.supabaseRequestService.getClient();
        const { error } = await supabase.from("feed_items").insert({
            ...item,
            published_at: item.published_at
                ? item.published_at.toISOString()
                : null,
        });

        return error;
    }
}
