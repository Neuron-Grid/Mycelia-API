import { Inject, Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { APP_ENV_TOKEN, type AppEnv } from "@/config/app-env";
import { Database } from "@/types/schema";

@Injectable()
export class SupabaseAdminService {
    private readonly logger = new Logger(SupabaseAdminService.name);
    private readonly admin: SupabaseClient<Database>;

    constructor(@Inject(APP_ENV_TOKEN) private readonly appEnv: AppEnv) {
        const { url, serviceRoleKey } = this.appEnv.getSupabaseConfig();
        this.admin = createClient<Database>(url, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        this.logger.debug("Initialized Supabase service-role client");
    }

    getClient(): SupabaseClient<Database> {
        return this.admin;
    }
}
