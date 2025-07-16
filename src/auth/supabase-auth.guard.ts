import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import { Request } from "express";
import { SupabaseRequestService } from "src/supabase-request.service";
import { Database } from "src/types/schema";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
    ) {}

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

        // request.user にユーザー情報をセット
        request.user = data.user;
        return true;
    }
}
