import { Module } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { APP_ENV_TOKEN, type AppEnv } from "@/config/app-env";
import { Database } from "./types/schema";

export const SUPABASE_CLIENT = "SUPABASE_CLIENT";

@Module({
    providers: [
        {
            provide: SUPABASE_CLIENT,
            useFactory: (appEnv: AppEnv): SupabaseClient<Database> => {
                const { url, anonKey } = appEnv.getSupabaseConfig();
                return createClient(url, anonKey);
            },
            inject: [APP_ENV_TOKEN],
        },
    ],
    exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
