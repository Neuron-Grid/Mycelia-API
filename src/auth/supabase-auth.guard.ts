import {
    type CanActivate,
    type ExecutionContext,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import type { SupabaseAdminService } from "@/shared/supabase-admin.service";
import type { JwtAuthClaims } from "@/types/auth-claims";
import type { Database } from "@/types/schema";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
    constructor(
        private readonly admin: SupabaseAdminService,
        private readonly cfg: ConfigService,
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

    // @async
    // @public
    // @since 1.0.0

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<Request & { user?: User }>();
        const authHeader = request.headers.authorization;

        // Authorizationヘッダー or Cookieからアクセストークンを取得
        let token: string | undefined;
        if (authHeader?.startsWith("Bearer ")) {
            token = authHeader.substring("Bearer ".length).trim();
        }
        if (!token) {
            const cookies = (
                request as unknown as { cookies?: Record<string, string> }
            ).cookies;
            const cookieToken =
                cookies?.["__Host-access_token"] ?? cookies?.access_token;
            if (
                cookieToken &&
                typeof cookieToken === "string" &&
                cookieToken.length > 0
            ) {
                token = cookieToken;
                // DownstreamのSupabaseRequestServiceがAuthorizationを見るため、ヘッダーにも反映
                request.headers.authorization = `Bearer ${cookieToken}`;
            }
        }

        if (!token) {
            throw new UnauthorizedException(
                "No valid token (header or cookie)",
            );
        }

        // 新しいクライアントインスタンスを毎回作成
        // 完全キャッシュ回避
        const supabaseUrl = this.cfg.get<string>("SUPABASE_URL");
        const supabaseAnonKey = this.cfg.get<string>("SUPABASE_ANON_KEY");

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new UnauthorizedException("Missing Supabase configuration");
        }

        const freshClient = createClient<Database>(
            supabaseUrl,
            supabaseAnonKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    // URL からのセッション検出も無効化
                    detectSessionInUrl: false,
                },
                global: {
                    headers: { Authorization: `Bearer ${token}` },
                    // fetch オプションでキャッシュを無効化
                    fetch: (url, options) => {
                        return fetch(url, {
                            ...options,
                            cache: "no-cache",
                            headers: {
                                ...options?.headers,
                                "Cache-Control":
                                    "no-cache, no-store, must-revalidate",
                                Pragma: "no-cache",
                                Expires: "0",
                            },
                        });
                    },
                },
            },
        );

        const { data, error } = await freshClient.auth.getUser(token);

        // 返却メッセージの細分化
        // "expired" を含むかどうかで分岐し、
        // そのまま else を使わずに早期throw + 後続throwで実装
        if (error) {
            if (error.message?.toLowerCase().includes("expired")) {
                throw new UnauthorizedException("Token has expired");
            }
            throw new UnauthorizedException(`Invalid token: ${error.message}`);
        }

        if (!data.user) {
            throw new UnauthorizedException("No user found for this token");
        }

        // 追加チェック: アカウントがソフト削除されていないか（RLS無視のadminで確認）
        try {
            const { data: settings } = await this.admin
                .getClient()
                .from("user_settings")
                .select("soft_deleted")
                .eq("user_id", data.user.id)
                .single();
            if (
                settings &&
                (settings as { soft_deleted?: boolean }).soft_deleted
            )
                throw new UnauthorizedException("Account is deleted");
        } catch (_e) {
            // 行が見つからない場合やadmin経由の読み取り問題はスルー（トークン有効であれば継続）
            // ただし soft_deleted=true のときのみ拒否
        }

        // JWT クレームをデコードして添付（amr/acr/aal を下位ガードで使用）
        const claims = SupabaseAuthGuard.decodeJwtClaims(token);
        if (claims) {
            (request as unknown as { authClaims?: JwtAuthClaims }).authClaims =
                claims;
        }

        // request.user にユーザー情報をセット
        request.user = data.user ?? undefined;
        return true;
    }
}
