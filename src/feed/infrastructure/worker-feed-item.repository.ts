import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";

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
        const rpcPayload = {
            p_user_id: userId,
            p_subscription_id: subscriptionId,
            p_title: title,
            p_link: link,
            p_description: description,
            // RPC 型が string（非 null）であるため、null になる場合は既定値を設定
            p_published_at: (publishedAt ?? new Date(0)).toISOString(),
            p_canonical_url: canonicalUrl,
        };
        const { data, error } = await sb.rpc(
            "fn_insert_feed_item",
            rpcPayload as never,
        );
        if (error) {
            this.logger.error(`fn_insert_feed_item: ${error.message}`);
            throw error as Error;
        }
        const row = data?.[0];
        return { id: row?.id ?? null, inserted: Boolean(row?.inserted) };
    }
}
