import { Injectable } from "@nestjs/common";
import { SupabaseAuthCacheService } from "@/auth/supabase-auth-cache.service";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";

@Injectable()
export class UserVerificationService {
    constructor(
        private readonly admin: SupabaseAdminService,
        private readonly cache: SupabaseAuthCacheService,
    ) {}

    async isAccountActive(userId: string): Promise<boolean> {
        const cached = await this.cache.get(userId);
        if (cached) {
            return !cached.isDeleted && !cached.isSoftDeleted;
        }

        const adminClient = this.admin.getClient();
        const [settingsRes, userRes] = await Promise.all([
            adminClient
                .from("user_settings")
                .select("soft_deleted")
                .eq("user_id", userId)
                .maybeSingle(),
            adminClient
                .from("users")
                .select("deleted_at")
                .eq("id", userId)
                .maybeSingle(),
        ]);

        const userRow = userRes.data as { deleted_at?: string | null } | null;
        const settingsRow = settingsRes.data as {
            soft_deleted?: boolean;
        } | null;

        const isDeleted =
            !!userRes.error || !userRow || userRow.deleted_at !== null;
        const isSoftDeleted =
            !!settingsRes.error || Boolean(settingsRow?.soft_deleted);

        this.cache.set(userId, {
            isDeleted,
            isSoftDeleted,
        });

        return !(isDeleted || isSoftDeleted);
    }
}
