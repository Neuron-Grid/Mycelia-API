import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "src/shared/supabase-admin.service";
import { Database } from "@/types/schema";

type Row = Database["public"]["Tables"]["user_subscriptions"]["Row"];

@Injectable()
export class SubscriptionAdminRepository {
    private readonly logger = new Logger(SubscriptionAdminRepository.name);
    constructor(private readonly admin: SupabaseAdminService) {}

    async findDueSubscriptions(cutoff: Date): Promise<Row[]> {
        const sb = this.admin.getClient();
        const { data, error } = await sb
            .from("user_subscriptions")
            .select("*")
            .lte("next_fetch_at", cutoff.toISOString())
            .eq("soft_deleted", false)
            .order("next_fetch_at", { ascending: true });

        if (error) {
            this.logger.error(
                `findDueSubscriptions(admin): ${JSON.stringify(error)}`,
            );
            throw error as Error;
        }
        return data ?? [];
    }
}
