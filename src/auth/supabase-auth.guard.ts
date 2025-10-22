import { performance } from "node:perf_hooks";
import {
    type CanActivate,
    type ExecutionContext,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { JwtAuthClaims } from "@/types/auth-claims";
import type { Database } from "@/types/schema";
import { SupabaseAuthCacheService } from "./supabase-auth-cache.service";
import {
    type AuthGuardMetricOutcome,
    SupabaseAuthMetricsService,
} from "./supabase-auth-metrics.service";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
    private anonClient: SupabaseClient<Database> | null = null;

    constructor(
        private readonly admin: SupabaseAdminService,
        private readonly cfg: ConfigService,
        private readonly cache: SupabaseAuthCacheService,
        private readonly metrics: SupabaseAuthMetricsService,
    ) {}

    private static decodeJwtClaims(token: string): JwtAuthClaims | null {
        try {
            const [, payload] = token.split(".");
            if (!payload) return null;
            const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
            const pad =
                normalized.length % 4
                    ? "=".repeat(4 - (normalized.length % 4))
                    : "";
            const json = Buffer.from(normalized + pad, "base64").toString(
                "utf8",
            );
            const obj = JSON.parse(json) as Record<string, unknown>;
            const amr = Array.isArray(obj.amr)
                ? ((obj.amr as unknown[]).filter(
                      (v) => typeof v === "string",
                  ) as string[])
                : undefined;
            return { ...(obj as JwtAuthClaims), amr };
        } catch {
            return null;
        }
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const startedAt = performance.now();
        let currentUserId: string | undefined;

        try {
            const request = context
                .switchToHttp()
                .getRequest<Request & { user?: User }>();
            const token = this.extractToken(request);

            if (!token) {
                this.recordMetric("invalid_token", startedAt);
                throw new UnauthorizedException(
                    "No valid token (header or cookie)",
                );
            }

            const client = this.getAnonClient();
            const { data, error } = await client.auth.getUser(token);

            if (error) {
                const lower = error.message?.toLowerCase() ?? "";
                const outcome: AuthGuardMetricOutcome = lower.includes(
                    "expired",
                )
                    ? "token_expired"
                    : "invalid_token";
                this.recordMetric(outcome, startedAt);
                throw new UnauthorizedException(
                    outcome === "token_expired"
                        ? "Token has expired"
                        : `Invalid token: ${error.message}`,
                );
            }

            if (!data.user) {
                this.recordMetric("invalid_token", startedAt);
                throw new UnauthorizedException("No user found for this token");
            }

            currentUserId = data.user.id;

            const active = await this.ensureAccountActive(currentUserId);
            if (!active) {
                this.recordMetric("deleted", startedAt, currentUserId);
                throw new UnauthorizedException("Account is deleted");
            }

            const claims = SupabaseAuthGuard.decodeJwtClaims(token);
            if (claims) {
                (
                    request as unknown as { authClaims?: JwtAuthClaims }
                ).authClaims = claims;
            }

            request.user = data.user ?? undefined;
            this.recordMetric("success", startedAt, currentUserId);
            return true;
        } catch (error) {
            if (!(error instanceof UnauthorizedException)) {
                this.recordMetric("error", startedAt, currentUserId);
            }
            throw error;
        }
    }

    private recordMetric(
        outcome: AuthGuardMetricOutcome,
        startedAt: number,
        userId?: string,
    ): void {
        const durationMs = performance.now() - startedAt;
        this.metrics.record({ outcome, durationMs, userId });
    }

    private extractToken(
        request: Request & { user?: User },
    ): string | undefined {
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
            return authHeader.substring("Bearer ".length).trim();
        }

        const cookies = (
            request as unknown as {
                cookies?: Record<string, string>;
            }
        ).cookies;
        const cookieToken =
            cookies?.["__Host-access_token"] ?? cookies?.access_token;
        if (cookieToken && typeof cookieToken === "string") {
            request.headers.authorization = `Bearer ${cookieToken}`;
            return cookieToken;
        }
        return undefined;
    }

    private async ensureAccountActive(userId: string): Promise<boolean> {
        const cached = this.cache.get(userId);
        if (cached) {
            return !cached.isDeleted && !cached.isSoftDeleted;
        }

        const adminClient = this.admin.getClient();
        const [settingsRes, userRes] = await Promise.all([
            adminClient
                .from("user_settings")
                .select("soft_deleted")
                .eq("user_id", userId)
                .maybeSingle(),
            adminClient
                .from("users")
                .select("deleted_at")
                .eq("id", userId)
                .maybeSingle(),
        ]);

        const userRow = userRes.data as { deleted_at?: string | null } | null;
        const settingsRow = settingsRes.data as {
            soft_deleted?: boolean;
        } | null;

        const isDeleted =
            !!userRes.error || !userRow || userRow.deleted_at !== null;
        const isSoftDeleted =
            !!settingsRes.error || Boolean(settingsRow?.soft_deleted);

        this.cache.set(userId, {
            isDeleted,
            isSoftDeleted,
        });

        return !(isDeleted || isSoftDeleted);
    }

    private getAnonClient(): SupabaseClient<Database> {
        if (this.anonClient) {
            return this.anonClient;
        }

        const supabaseUrl = this.cfg.get<string>("SUPABASE_URL");
        const supabaseAnonKey = this.cfg.get<string>("SUPABASE_ANON_KEY");

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error("Missing Supabase configuration");
        }

        this.anonClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
            },
            global: {
                fetch: (url, options) =>
                    fetch(url, {
                        ...options,
                        cache: "no-cache",
                        headers: {
                            ...options?.headers,
                            "Cache-Control":
                                "no-cache, no-store, must-revalidate",
                            Pragma: "no-cache",
                            Expires: "0",
                        },
                    }),
            },
        });

        return this.anonClient;
    }
}
