import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { Database } from "@/types/schema";

type Row = Database["public"]["Tables"]["user_subscriptions"]["Row"];

@Injectable()
export class SubscriptionAdminRepository {
    private readonly logger = new Logger(SubscriptionAdminRepository.name);
    constructor(private readonly admin: SupabaseAdminService) {}

    async findDueSubscriptions(cutoff: Date): Promise<Row[]> {
        const sb = this.admin.getClient();
        const { data, error } = await sb.rpc("fn_find_due_subscriptions", {
            p_cutoff: cutoff.toISOString(),
        });
        if (error) {
            this.logger.error(
                `fn_find_due_subscriptions(admin): ${JSON.stringify(error)}`,
            );
            throw error as Error;
        }
        return (data as Row[]) ?? [];
    }
}
