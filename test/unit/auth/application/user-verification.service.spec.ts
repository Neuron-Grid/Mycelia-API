import { createClient } from "@supabase/supabase-js";
import { UserVerificationService } from "@/auth/application/user-verification.service";
import type { SupabaseAuthCacheService } from "@/auth/supabase-auth-cache.service";
import type { AppEnv } from "@/config/app-env";

jest.mock("@supabase/supabase-js", () => ({
    createClient: jest.fn(),
}));

type MaybeSingleResult = { data: unknown; error: { message: string } | null };

describe("UserVerificationService", () => {
    const userId = "user-123";
    let cache: jest.Mocked<SupabaseAuthCacheService>;
    let responses: Record<"user_settings" | "users", MaybeSingleResult>;
    let appEnv: AppEnv;

    beforeEach(() => {
        (createClient as jest.Mock).mockReset();
        cache = {
            get: jest.fn(),
            set: jest.fn(),
            evict: jest.fn(),
        } as unknown as jest.Mocked<SupabaseAuthCacheService>;

        responses = {
            user_settings: { data: { soft_deleted: false }, error: null },
            users: { data: { deleted_at: null }, error: null },
        };

        const userClient = {
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
        (createClient as jest.Mock).mockReturnValue(userClient);
        appEnv = {
            getSupabaseConfig: () => ({
                url: "https://example.supabase.co",
                anonKey: "anon",
                serviceRoleKey: "service",
            }),
        } as unknown as AppEnv;
    });

    it("returns cached state when cache is hit", async () => {
        const service = new UserVerificationService(appEnv, cache);
        cache.get.mockResolvedValue({
            isDeleted: false,
            isSoftDeleted: false,
            expiresAt: Date.now() + 1_000,
        });

        const active = await service.isAccountActive(userId, "token");

        expect(active).toBe(true);
        expect(createClient).not.toHaveBeenCalled();
    });

    it("returns false after cache eviction when user became deleted", async () => {
        const service = new UserVerificationService(appEnv, cache);
        cache.get.mockResolvedValueOnce(null);

        const initiallyActive = await service.isAccountActive(userId, "token");

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
        cache.get.mockResolvedValueOnce(null);

        const afterDeletion = await service.isAccountActive(userId, "token");

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
