import { jest } from "@test-utils/jest-globals";
import { UserVerificationService } from "@/auth/application/user-verification.service";
import type { SupabaseAuthCacheService } from "@/auth/supabase-auth-cache.service";
import type { SupabaseAdminService } from "@/shared/supabase-admin.service";

type MaybeSingleResult = { data: unknown; error: { message: string } | null };

describe("UserVerificationService", () => {
    const userId = "user-123";
    let cache: jest.Mocked<SupabaseAuthCacheService>;
    let adminService: jest.Mocked<SupabaseAdminService>;
    let responses: Record<"user_settings" | "users", MaybeSingleResult>;

    beforeEach(() => {
        cache = {
            get: jest.fn(),
            set: jest.fn(),
            evict: jest.fn(),
        } as unknown as jest.Mocked<SupabaseAuthCacheService>;

        responses = {
            user_settings: { data: { soft_deleted: false }, error: null },
            users: { data: { deleted_at: null }, error: null },
        };

        const adminClient = {
            from: jest.fn((table: "user_settings" | "users") => {
                const builder = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest
                        .fn()
                        .mockImplementation(async () => responses[table]),
                };
                return builder;
            }),
        };

        adminService = {
            getClient: jest.fn().mockReturnValue(adminClient),
        } as unknown as jest.Mocked<SupabaseAdminService>;
    });

    it("returns cached state when cache is hit", async () => {
        const service = new UserVerificationService(adminService, cache);
        cache.get.mockReturnValue({
            isDeleted: false,
            isSoftDeleted: false,
            expiresAt: Date.now() + 1_000,
        });

        const active = await service.isAccountActive(userId);

        expect(active).toBe(true);
        expect(adminService.getClient).not.toHaveBeenCalled();
    });

    it("returns false after cache eviction when user became deleted", async () => {
        const service = new UserVerificationService(adminService, cache);
        cache.get.mockReturnValueOnce(null);

        const initiallyActive = await service.isAccountActive(userId);

        expect(initiallyActive).toBe(true);
        expect(cache.set).toHaveBeenCalledWith(
            userId,
            expect.objectContaining({
                isDeleted: false,
                isSoftDeleted: false,
            }),
        );

        responses = {
            user_settings: { data: { soft_deleted: true }, error: null },
            users: {
                data: { deleted_at: new Date().toISOString() },
                error: null,
            },
        };
        cache.get.mockReturnValueOnce(null);

        const afterDeletion = await service.isAccountActive(userId);

        expect(afterDeletion).toBe(false);
        expect(cache.set).toHaveBeenLastCalledWith(
            userId,
            expect.objectContaining({
                isDeleted: true,
                isSoftDeleted: true,
            }),
        );
    });
});
