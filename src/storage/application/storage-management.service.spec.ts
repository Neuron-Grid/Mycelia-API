import type { ConfigService } from "@nestjs/config";
import { jest } from "@test-utils/jest-globals";
import type { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { StorageManagementService } from "./storage-management.service";

describe("StorageManagementService", () => {
    const bucket = "bucket";
    const path = "path/file.txt";
    const buffer = Buffer.from("payload");
    const contentType = "text/plain";

    let configService: jest.Mocked<ConfigService>;
    let adminService: jest.Mocked<SupabaseAdminService>;
    let upload: jest.Mock;
    let getPublicUrl: jest.Mock;

    const createService = (flagValue?: string | boolean | null) => {
        configService = {
            get: jest.fn().mockImplementation((key: string) => {
                if (key === "STORAGE_R2_MIGRATION_ENABLED") return flagValue;
                return undefined;
            }),
        } as unknown as jest.Mocked<ConfigService>;

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

        return new StorageManagementService(adminService, configService);
    };

    it("uploads file to Supabase Storage when migration flag is disabled", async () => {
        const service = createService("false");

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
        const service = createService("true");

        await expect(
            service.uploadToStorage(bucket, path, buffer, contentType),
        ).rejects.toThrow("Supabase Storage upload is disabled");
        expect(upload).not.toHaveBeenCalled();
    });

    it("throws when upload fails", async () => {
        const service = createService(false);
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
