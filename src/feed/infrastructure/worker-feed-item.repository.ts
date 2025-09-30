import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { Database } from "@/types/schema";

type FnInsertFeedItemArgs =
    Database["public"]["Functions"]["fn_insert_feed_item"]["Args"];

// Supabase の型生成では DEFAULT NULL の引数が string 扱いになるため、
// 実行時に null を維持したまま渡せるよう型を合わせる。
const RPC_NULL = null as unknown as string;

@Injectable()
export class WorkerFeedItemRepository {
    private readonly logger = new Logger(WorkerFeedItemRepository.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    async insertFeedItem(
        subscriptionId: number,
        userId: string,
        title: string,
        link: string,
        description: string,
        publishedAt: Date | null,
        canonicalUrl: string | null = null,
    ): Promise<{ id: number | null; inserted: boolean }> {
        const sb = this.admin.getClient();
        const rpcPayload: FnInsertFeedItemArgs = {
            p_user_id: userId,
            p_subscription_id: subscriptionId,
            p_title: title,
            p_link: link,
            p_description: description,
            p_published_at: publishedAt ? publishedAt.toISOString() : RPC_NULL,
        };

        rpcPayload.p_canonical_url = canonicalUrl ?? RPC_NULL;

        const { data, error } = await sb.rpc("fn_insert_feed_item", rpcPayload);
        if (error) {
            this.logger.error(`fn_insert_feed_item: ${error.message}`);
            throw error as Error;
        }
        const row = data?.[0];
        return { id: row?.id ?? null, inserted: Boolean(row?.inserted) };
    }
}
