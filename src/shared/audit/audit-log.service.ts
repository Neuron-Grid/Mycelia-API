import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import type { PostgrestError } from "@supabase/supabase-js";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { Database, Json } from "@/types/schema";

type AuditOperation = "SOFT_DELETE" | "HARD_DELETE" | "BAN_USER";
type AuditResult = "SUCCESS" | "FAILURE";

export interface AuditLogParams {
    userId: string;
    operatorId: string;
    operation: AuditOperation;
    metadata: Record<string, unknown>;
    result: AuditResult;
}

@Injectable()
export class AuditLogService {
    private readonly logger = new Logger(AuditLogService.name);

    constructor(private readonly adminService: SupabaseAdminService) {}

    async logAdminOperation({
        userId,
        operatorId,
        operation,
        metadata,
        result,
    }: AuditLogParams): Promise<void> {
        const payload = {
            userId,
            operatorId,
            operation,
            result,
            metadata,
            loggedAt: new Date().toISOString(),
        };

        // CloudWatch 連携を想定したアプリケーションログ
        const baseLog = `[${operation}] user=${userId} operator=${operatorId} result=${result}`;
        const serializedMetadata = JSON.stringify(metadata);
        if (result === "FAILURE") {
            this.logger.error(`${baseLog} metadata=${serializedMetadata}`);
        } else {
            this.logger.log(`${baseLog} metadata=${serializedMetadata}`);
        }

        // DBへの永続化
        try {
            const admin = this.adminService.getClient();
            const insertPayload: Database["auth"]["Tables"]["audit_log_entries"]["Insert"] =
                {
                    id: randomUUID(),
                    payload: payload as Json,
                    ip_address:
                        (metadata.ipAddress as string | undefined) ?? "0.0.0.0",
                };

            const { error } = await admin
                .from("auth.audit_log_entries" as never)
                .insert(insertPayload as never);
            if (error) {
                this.handleInsertError(error, payload);
            }
        } catch (err) {
            this.logger.warn(
                `Failed to persist audit log (operation=${operation}, user=${userId}): ${String(
                    err,
                )}`,
            );
        }
    }

    private handleInsertError(
        error: PostgrestError,
        payload: Record<string, unknown>,
    ) {
        this.logger.warn(
            `audit_log_entries insert failed: ${error.message} payload=${JSON.stringify(payload)}`,
        );
    }
}
