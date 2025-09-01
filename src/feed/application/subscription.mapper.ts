import type { Database } from "@/types/schema";
import type { SubscriptionDto } from "./dto/subscription.dto";

type Row = Database["public"]["Tables"]["user_subscriptions"]["Row"];

export const SubscriptionMapper = {
    rowToDto(row: Row): SubscriptionDto {
        return {
            id: row.id,
            feedUrl: row.feed_url,
            feedTitle: row.feed_title ?? null,
            lastFetchedAt: row.last_fetched_at,
            nextFetchAt: row.next_fetch_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    },
    listToDto(rows: Row[]): SubscriptionDto[] {
        return rows.map((r) => this.rowToDto(r));
    },
};
