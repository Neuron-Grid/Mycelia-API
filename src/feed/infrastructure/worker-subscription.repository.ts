import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { Database } from "@/types/schema";

type SubRow = Database["public"]["Tables"]["user_subscriptions"]["Row"];

@Injectable()
export class WorkerSubscriptionRepository {
    private readonly logger = new Logger(WorkerSubscriptionRepository.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    async getByIdForUser(
        userId: string,
        subscriptionId: number,
    ): Promise<SubRow | null> {
        const sb = this.admin.getClient();
        const { data, error } = await sb.rpc("fn_get_subscription_for_user", {
            p_user_id: userId,
            p_subscription_id: subscriptionId,
        });
        if (error) {
            this.logger.error(`fn_get_subscription_for_user: ${error.message}`);
            throw error as Error;
        }
        return (data?.[0] as SubRow | undefined) ?? null;
    }

    async markFetched(
        userId: string,
        subscriptionId: number,
        fetchedAt: Date,
    ): Promise<void> {
        const sb = this.admin.getClient();
        const { error } = await sb.rpc("fn_mark_subscription_fetched", {
            p_user_id: userId,
            p_subscription_id: subscriptionId,
            p_fetched_at: fetchedAt.toISOString(),
        });
        if (error) {
            this.logger.warn(
                `fn_mark_subscription_fetched failed: ${error.message}`,
            );
        }
    }
}
