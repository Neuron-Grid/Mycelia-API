import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_ENV_TOKEN, type AppEnv } from "@/config/app-env";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";

@Injectable()
export class StorageManagementService {
    private readonly logger = new Logger(StorageManagementService.name);
    private readonly supabaseUploadEnabled: boolean;

    constructor(
        private readonly adminService: SupabaseAdminService,
        @Inject(APP_ENV_TOKEN) private readonly appEnv: AppEnv,
    ) {
        const { supabaseUploadEnabled } = this.appEnv.getStorageConfig();
        this.supabaseUploadEnabled = supabaseUploadEnabled;
    }

    async uploadToStorage(
        bucket: string,
        path: string,
        fileBuffer: Buffer,
        contentType = "application/octet-stream",
    ): Promise<{ publicUrl: string }> {
        if (!this.supabaseUploadEnabled) {
            this.logger.warn(
                `Supabase Storage upload skipped due to R2 migration flag (bucket=${bucket}, path=${path})`,
            );
            throw new Error("Supabase Storage upload is disabled");
        }

        const admin = this.adminService.getClient();
        const { error } = await admin.storage
            .from(bucket)
            .upload(path, fileBuffer, {
                contentType,
                upsert: true,
            });
        if (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : typeof error === "object" &&
                        error !== null &&
                        "message" in error &&
                        typeof (error as { message?: unknown }).message ===
                            "string"
                      ? (error as { message: string }).message
                      : typeof error === "object" && error !== null
                        ? JSON.stringify(error)
                        : String(error);
            throw new Error(
                `Failed to upload file to Supabase Storage: ${message}`,
            );
        }

        const { data: urlData } = admin.storage.from(bucket).getPublicUrl(path);
        return { publicUrl: urlData.publicUrl };
    }
}
