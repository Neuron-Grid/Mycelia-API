import { jest } from "@test-utils/jest-globals";
import type { SupabaseAuthCacheService } from "@/auth/supabase-auth-cache.service";
import type { AuditLogService } from "@/shared/audit/audit-log.service";
import type { DistributedLockService } from "@/shared/lock/distributed-lock.service";
import type { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { AuthAccountDeletionService } from "./auth-account-deletion.service";

describe("AuthAccountDeletionService", () => {
    const userId = "user-123";
    const operatorId = "operator-456";
    let service: AuthAccountDeletionService;
    let lockService: jest.Mocked<DistributedLockService>;
    let adminService: jest.Mocked<SupabaseAdminService>;
    let auditLogService: jest.Mocked<AuditLogService>;
    let authCache: { evict: jest.Mock };
    let adminClient: {
        rpc: jest.Mock;
        auth: { admin: { updateUserById: jest.Mock } };
    };

    beforeEach(() => {
        adminClient = {
            rpc: jest.fn().mockResolvedValue({
                data: {
                    soft_deleted: true,
                    deleted_at: "2024-01-01T00:00:00.000Z",
                },
                error: null,
            }),
            auth: {
                admin: {
                    updateUserById: jest.fn().mockResolvedValue({
                        data: { id: userId },
                        error: null,
                    }),
                },
            },
        };

        lockService = {
            acquire: jest.fn().mockResolvedValue("lock-id"),
            release: jest.fn().mockResolvedValue(true),
        } as unknown as jest.Mocked<DistributedLockService>;

        adminService = {
            getClient: jest.fn().mockReturnValue(adminClient),
        } as unknown as jest.Mocked<SupabaseAdminService>;

        auditLogService = {
            logAdminOperation: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<AuditLogService>;
        authCache = { evict: jest.fn() };

        service = new AuthAccountDeletionService(
            lockService,
            adminService,
            auditLogService,
            authCache as unknown as SupabaseAuthCacheService,
        );
    });

    it("performs soft delete, ban, and signs out", async () => {
        const signOutSession = jest.fn().mockResolvedValue(undefined);

        const result = await service.execute(userId, {
            operatorId,
            signOutSession,
        });

        expect(result.softDeleted).toBe(true);
        expect(adminClient.rpc).toHaveBeenCalledWith(
            "soft_delete_user_account",
            {
                p_user_id: userId,
            },
        );
        expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledTimes(1);
        expect(signOutSession).toHaveBeenCalledTimes(1);
        expect(authCache.evict).toHaveBeenCalledWith(userId);
        expect(lockService.release).toHaveBeenCalledWith(
            `auth-account-delete:${userId}`,
            "lock-id",
        );
    });

    it("logs ban failure when Supabase returns an error", async () => {
        adminClient.auth.admin.updateUserById.mockResolvedValueOnce({
            data: null,
            error: { message: "ban failed" },
        });

        const result = await service.execute(userId, { operatorId });

        expect(result.softDeleted).toBe(true);
        expect(auditLogService.logAdminOperation).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: "BAN_USER",
                result: "FAILURE",
                metadata: expect.objectContaining({ stage: "BAN" }),
            }),
        );
        expect(authCache.evict).toHaveBeenCalledWith(userId);
        expect(
            auditLogService.logAdminOperation.mock.calls
                .filter(([call]) => call.operation === "SOFT_DELETE")
                .at(-1)?.[0].metadata?.banApplied,
        ).toBe(false);
    });

    it("throws when lock cannot be acquired", async () => {
        lockService.acquire.mockResolvedValueOnce(null);

        await expect(service.execute(userId, { operatorId })).rejects.toThrow(
            "Account deletion is already in progress",
        );

        expect(auditLogService.logAdminOperation).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({ stage: "LOCK" }),
                result: "FAILURE",
            }),
        );
    });

    it("releases lock when RPC fails", async () => {
        adminClient.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: "rpc failure" },
        });

        await expect(service.execute(userId, { operatorId })).rejects.toThrow(
            "soft_delete_user_account RPC failed: rpc failure",
        );

        expect(lockService.release).toHaveBeenCalledWith(
            `auth-account-delete:${userId}`,
            "lock-id",
        );
    });
});
