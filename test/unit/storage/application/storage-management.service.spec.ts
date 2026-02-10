import type { AppEnv, StorageConfig } from "@/config/app-env";
import type { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { StorageManagementService } from "@/storage/application/storage-management.service";

describe("StorageManagementService", () => {
    const bucket = "bucket";
    const path = "path/file.txt";
    const buffer = Buffer.from("payload");
    const contentType = "text/plain";

    let appEnv: jest.Mocked<AppEnv>;
    let adminService: jest.Mocked<SupabaseAdminService>;
    let upload: jest.Mock;
    let getPublicUrl: jest.Mock;

    const createService = (config: StorageConfig) => {
        appEnv = {
            getStorageConfig: jest.fn().mockReturnValue(config),
        } as unknown as jest.Mocked<AppEnv>;

        upload = jest.fn().mockResolvedValue({ error: null });
        getPublicUrl = jest.fn().mockReturnValue({
            data: { publicUrl: "https://example.com/file.txt" },
        });

        adminService = {
            getClient: jest.fn().mockReturnValue({
                storage: {
                    from: jest.fn().mockReturnValue({
                        upload,
                        getPublicUrl,
                    }),
                },
            }),
        } as unknown as jest.Mocked<SupabaseAdminService>;

        return new StorageManagementService(adminService, appEnv);
    };

    it("uploads file to Supabase Storage when migration flag is disabled", async () => {
        const service = createService({ supabaseUploadEnabled: true });

        const result = await service.uploadToStorage(
            bucket,
            path,
            buffer,
            contentType,
        );

        expect(upload).toHaveBeenCalledWith(path, buffer, {
            contentType,
            upsert: true,
        });
        expect(result.publicUrl).toBe("https://example.com/file.txt");
    });

    it("throws when migration flag disables Supabase Storage", async () => {
        const service = createService({ supabaseUploadEnabled: false });

        await expect(
            service.uploadToStorage(bucket, path, buffer, contentType),
        ).rejects.toThrow("Supabase Storage upload is disabled");
        expect(upload).not.toHaveBeenCalled();
    });

    it("throws when upload fails", async () => {
        const service = createService({ supabaseUploadEnabled: true });
        upload.mockResolvedValueOnce({
            error: { message: "upload failed" },
        });

        await expect(
            service.uploadToStorage(bucket, path, buffer, contentType),
        ).rejects.toThrow(
            "Failed to upload file to Supabase Storage: upload failed",
        );
    });
});
