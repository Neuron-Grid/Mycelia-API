import type { SupabaseConfig } from "@/config/app-env";

export function buildSupabaseConfig(env: NodeJS.ProcessEnv): SupabaseConfig {
    const url = env.SUPABASE_URL?.trim() ?? "";
    const anonKey = env.SUPABASE_ANON_KEY?.trim() ?? "";
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

    if (!url || !anonKey) {
        throw new Error(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be configured",
        );
    }
    if (!serviceRoleKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY must be configured");
    }

    return {
        url,
        anonKey,
        serviceRoleKey,
    };
}
