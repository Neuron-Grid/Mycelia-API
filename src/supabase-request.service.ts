// @file Supabaseクライアントのリクエストスコープサービス
import { Inject, Injectable, Scope } from "@nestjs/common";
// @see https://docs.nestjs.com/providers#injection-scopes
import { REQUEST } from "@nestjs/core";
// @see https://supabase.com/docs/reference/javascript/create-client
import { createClient, SupabaseClient } from "@supabase/supabase-js";
// @see https://expressjs.com/
import { Request } from "express";
import { APP_ENV_TOKEN, type AppEnv } from "@/config/app-env";
// @see ./types/schema
import { Database } from "@/types/schema";

@Injectable({ scope: Scope.REQUEST })
// @public
// @since 1.0.0
export class SupabaseRequestService {
    // @type {SupabaseClient<Database>}
    // @readonly
    // @private
    private readonly sbAnon: SupabaseClient<Database>;

    // @param {Request} req - Expressリクエスト
    // @since 1.0.0
    // @public
    constructor(
        @Inject(REQUEST) private readonly req: Request,
        @Inject(APP_ENV_TOKEN) private readonly appEnv: AppEnv,
    ) {
        const { url, anonKey } = this.appEnv.getSupabaseConfig();

        // 通常クライアント
        // RLS 適用
        // Authorizationヘッダが無ければCookieのaccess_tokenを利用
        const headerToken = (this.req.headers.authorization ?? "").replace(
            /^Bearer\s+/i,
            "",
        );
        const cookieToken =
            (this.req as unknown as { cookies?: Record<string, string> })
                .cookies?.["__Host-access_token"] ??
            (this.req as unknown as { cookies?: Record<string, string> })
                .cookies?.access_token;
        const token = headerToken || cookieToken || "";
        this.sbAnon = createClient<Database>(url, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
            global: {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
        });
    }

    // @public
    // @since 1.0.0
    // @returns {SupabaseClient<Database>} - RLS適用クライアント
    // @example
    // const client = supabaseRequestService.getClient()
    getClient(): SupabaseClient<Database> {
        return this.sbAnon;
    }
}
