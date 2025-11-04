import { Injectable, Logger } from "@nestjs/common";
import type { PostgrestError } from "@supabase/supabase-js";
import { AuditLogService } from "@/shared/audit/audit-log.service";
import { DistributedLockService } from "@/shared/lock/distributed-lock.service";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";

type SoftDeleteResult = {
    soft_deleted?: boolean;
    deleted_at?: string | null;
} | null;

interface AuthAccountDeletionOptions {
    operatorId?: string;
    signOutSession?: () => Promise<void>;
}

@Injectable()
export class AuthAccountDeletionService {
    private readonly logger = new Logger(AuthAccountDeletionService.name);
    private readonly lockTimeoutMs = 10_000;
    private readonly banDurationHours = "87600h";

    constructor(
        private readonly lockService: DistributedLockService,
        private readonly adminService: SupabaseAdminService,
        private readonly auditLogService: AuditLogService,
    ) {}

    async execute(userId: string, options?: AuthAccountDeletionOptions) {
        const operatorId = options?.operatorId ?? userId;
        const lockKey = `auth-account-delete:${userId}`;
        const lockId = await this.lockService.acquire(
            lockKey,
            this.lockTimeoutMs,
        );
        if (!lockId) {
            await this.auditLogService.logAdminOperation({
                userId,
                operatorId,
                operation: "SOFT_DELETE",
                result: "FAILURE",
                metadata: {
                    stage: "LOCK",
                    message: "Failed to acquire distributed lock",
                },
            });
            throw new Error("Account deletion is already in progress");
        }

        try {
            await this.logStage(userId, operatorId, "START");

            const softDeleteResult = await this.invokeSoftDeleteRpc(
                userId,
                operatorId,
            );
            await this.logStage(
                userId,
                operatorId,
                "RPC_COMPLETE",
                softDeleteResult,
            );

            const banApplied = await this.applyBan(userId, operatorId);

            const sessionSignedOut = await this.trySignOut(
                options?.signOutSession,
            );

            await this.auditLogService.logAdminOperation({
                userId,
                operatorId,
                operation: "SOFT_DELETE",
                result: "SUCCESS",
                metadata: {
                    stage: "COMPLETE",
                    deletedAt: softDeleteResult?.deleted_at ?? null,
                    banApplied,
                    sessionSignedOut,
                },
            });

            const deletedAt =
                typeof softDeleteResult?.deleted_at === "string"
                    ? softDeleteResult.deleted_at
                    : new Date().toISOString();

            return { softDeleted: true, deletedAt };
        } catch (error) {
            await this.auditLogService.logAdminOperation({
                userId,
                operatorId,
                operation: "SOFT_DELETE",
                result: "FAILURE",
                metadata: {
                    stage: "FAILED",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                },
            });
            throw error;
        } finally {
            await this.lockService.release(lockKey, lockId);
        }
    }

    private async logStage(
        userId: string,
        operatorId: string,
        stage: "START" | "RPC_COMPLETE",
        rpcResult?: SoftDeleteResult,
    ) {
        await this.auditLogService.logAdminOperation({
            userId,
            operatorId,
            operation: "SOFT_DELETE",
            result: "SUCCESS",
            metadata: {
                stage,
                deletedAt: rpcResult?.deleted_at ?? null,
            },
        });
    }

    private async invokeSoftDeleteRpc(
        userId: string,
        operatorId: string,
    ): Promise<SoftDeleteResult> {
        this.logger.debug(
            `Invoking soft_delete_user_account RPC for user=${userId}`,
        );
        const admin = this.adminService.getClient();
        const { data, error } = await admin.rpc("soft_delete_user_account", {
            p_user_id: userId,
        });
        if (error) {
            await this.auditLogService.logAdminOperation({
                userId,
                operatorId,
                operation: "SOFT_DELETE",
                result: "FAILURE",
                metadata: {
                    stage: "RPC",
                    error: error.message,
                },
            });
            throw new Error(
                `soft_delete_user_account RPC failed: ${(error as PostgrestError).message}`,
            );
        }

        const result = data as SoftDeleteResult;
        if (!result?.soft_deleted) {
            throw new Error(
                "soft_delete_user_account RPC returned unexpected payload",
            );
        }
        return result;
    }

    private async applyBan(
        userId: string,
        operatorId: string,
    ): Promise<boolean> {
        this.logger.debug(`Applying ban via admin API for user=${userId}`);
        try {
            const adminClient = this.adminService.getClient();
            const { data, error } = await adminClient.auth.admin.updateUserById(
                userId,
                {
                    ban_duration: this.banDurationHours,
                } as unknown as { ban_duration: string },
            );

            if (error) {
                throw new Error(
                    `Supabase ban failed: ${error.message ?? "unknown error"}`,
                );
            }

            if (!data) {
                throw new Error("Supabase ban returned empty payload");
            }

            await this.auditLogService.logAdminOperation({
                userId,
                operatorId,
                operation: "BAN_USER",
                result: "SUCCESS",
                metadata: {
                    stage: "BAN",
                    banDuration: this.banDurationHours,
                },
            });
            return true;
        } catch (error) {
            await this.auditLogService.logAdminOperation({
                userId,
                operatorId,
                operation: "BAN_USER",
                result: "FAILURE",
                metadata: {
                    stage: "BAN",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                },
            });
            this.logger.warn(
                `Failed to apply ban for user=${userId}: ${error instanceof Error ? error.message : error}`,
            );
            return false;
        }
    }

    private async trySignOut(signOut?: () => Promise<void>): Promise<boolean> {
        if (!signOut) {
            return false;
        }
        try {
            await signOut();
            return true;
        } catch (error) {
            this.logger.debug(
                `Failed to sign out current session: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            return false;
        }
    }
}
