import { Inject, Injectable } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAuthCacheService } from "@/auth/supabase-auth-cache.service";
import {
    APP_ENV_TOKEN,
    type AppEnv,
    type SupabaseConfig,
} from "@/config/app-env";
import type { Database } from "@/types/schema";

@Injectable()
export class UserVerificationService {
    private readonly supabaseConfig: SupabaseConfig;

    constructor(
        @Inject(APP_ENV_TOKEN) appEnv: AppEnv,
        private readonly cache: SupabaseAuthCacheService,
    ) {
        this.supabaseConfig = appEnv.getSupabaseConfig();
    }

    async isAccountActive(userId: string, token: string): Promise<boolean> {
        const cached = await this.cache.get(userId);
        if (cached) {
            return !cached.isDeleted && !cached.isSoftDeleted;
        }

        if (!token) {
            this.cache.set(userId, { isDeleted: true, isSoftDeleted: true });
            return false;
        }

        const userClient = this.createUserScopedClient(token);
        const [settingsRes, userRes] = await Promise.all([
            userClient
                .from("user_settings")
                .select("soft_deleted")
                .eq("user_id", userId)
                .maybeSingle(),
            userClient
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

    private createUserScopedClient(token: string): SupabaseClient<Database> {
        const { url, anonKey } = this.supabaseConfig;
        return createClient<Database>(url, anonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
            },
            global: {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
        });
    }
}
