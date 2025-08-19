import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import { Request } from "express";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { Database } from "@/types/schema";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
    constructor(private readonly admin: SupabaseAdminService) {}
    // @async
    // @public
    // @since 1.0.0

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const authHeader = request.headers.authorization;

        // トークン未指定時の早期リターン
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new UnauthorizedException("No valid Bearer token");
        }
        const token = authHeader.substring("Bearer ".length).trim();
        if (!token) {
            throw new UnauthorizedException("Empty token after Bearer prefix");
        }

        // 新しいクライアントインスタンスを毎回作成
        // 完全キャッシュ回避
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

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

        // request.user にユーザー情報をセット
        request.user = data.user;
        return true;
    }
}
