import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/schema";

@Injectable()
export class SupabaseAdminService {
    private readonly logger = new Logger(SupabaseAdminService.name);
    private readonly admin: SupabaseClient<Database>;

    constructor() {
        const url = process.env.SUPABASE_URL;
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceRole) {
            throw new Error("SUPABASE_URL or SERVICE_ROLE_KEY missing");
        }
        this.admin = createClient<Database>(url, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        this.logger.debug("Initialized Supabase service-role client");
    }

    getClient(): SupabaseClient<Database> {
        return this.admin;
    }
}
