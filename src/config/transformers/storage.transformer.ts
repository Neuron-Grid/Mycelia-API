import type { StorageConfig } from "@/config/app-env";

function parseBoolean(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return undefined;
}

export function buildStorageConfig(env: NodeJS.ProcessEnv): StorageConfig {
    const migrationEnabled = parseBoolean(env.STORAGE_R2_MIGRATION_ENABLED);
    const supabaseUploadEnabled =
        migrationEnabled === undefined ? true : !migrationEnabled;

    return {
        supabaseUploadEnabled,
    };
}
