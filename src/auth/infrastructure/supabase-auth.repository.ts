import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { DistributedLockService } from "@/shared/lock/distributed-lock.service";
import { SupabaseRequestService } from "@/supabase-request.service";
import { AuthRepositoryPort } from "../domain/auth.repository";

type RpcInvoker = (
    fn: string,
    args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

@Injectable()
export class SupabaseAuthRepository implements AuthRepositoryPort {
    constructor(
        private readonly supabaseReq: SupabaseRequestService,
        private readonly lockService: DistributedLockService,
        private readonly cfg: ConfigService,
    ) {}

    // ... (other methods remain the same) ...
    async signUp(email: string, password: string, username: string) {
        const sb = this.supabaseReq.getClient();
        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: { data: { username } },
        });
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        return data;
    }

    async signIn(email: string, password: string) {
        const sb = this.supabaseReq.getClient();
        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            throw new HttpException(error.message, HttpStatus.UNAUTHORIZED);
        }
        return data;
    }

    async signOut(): Promise<void> {
        const sb = this.supabaseReq.getClient();
        const { error } = await sb.auth.signOut();
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
    }

    // アカウント削除（アプリ側ソフトデリート対応）
    // SECURITY DEFINERなRPCを呼び出し、関連テーブルのsoft_deletedと
    // users.deleted_atを単一トランザクションで更新する。
    // RPC内で失敗すれば例外が発生し、呼び出し元でロールバックされる。
    async deleteAccount(userId: string) {
        const admin = this.supabaseReq.getAdminClient();
        const invokeRpc = this.createAdminRpcInvoker();
        try {
            // 1) Supabase RPCを介してソフトデリート（単一トランザクション）
            const { data, error } = await invokeRpc(
                "soft_delete_user_account",
                { p_user_id: userId },
            );
            if (error) {
                const message =
                    (error as { message?: string })?.message ??
                    JSON.stringify(error);
                throw new Error(
                    `soft_delete_user_account RPC failed: ${message}`,
                );
            }

            type SoftDeleteResult = {
                soft_deleted?: boolean;
                deleted_at?: string | null;
            } | null;
            const result = data as SoftDeleteResult;
            if (!result?.soft_deleted) {
                throw new Error(
                    "soft_delete_user_account RPC returned unexpected payload",
                );
            }

            // 2) BAN（ban_duration）。JWTは依然有効のため、ガード/BullMQ側で無効化を継続。
            const BAN_DURATION = "87600h"; // 10年相当
            try {
                await admin.auth.admin.updateUserById(userId, {
                    // ban_duration: サポートされる時間表記（例: "1h", "7d"相当は"168h"）
                    // 公式の単位: ns, us, ms, s, m, h
                    ban_duration: BAN_DURATION as unknown as string,
                } as unknown as { ban_duration: string });
            } catch {
                // noop: BAN失敗は致命ではない（ガードで遮断済）
            }

            // 5) 現セッションをサインアウト（呼び出し元リクエストのセッション）
            const sb = this.supabaseReq.getClient();
            try {
                await sb.auth.signOut();
            } catch {
                // noop
            }

            const deletedAt =
                typeof result.deleted_at === "string"
                    ? result.deleted_at
                    : new Date().toISOString();
            return { softDeleted: true, deletedAt };
        } catch (err: unknown) {
            if (err instanceof Error) {
                throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
            }
            throw new HttpException("Unknown error", HttpStatus.BAD_REQUEST);
        }
    }

    async restoreAccount(userId: string) {
        const admin = this.supabaseReq.getAdminClient();
        const invokeRpc = this.createAdminRpcInvoker();

        try {
            // 1) SECURITY DEFINERなRPCでアカウントを復元
            const { data, error } = await invokeRpc("restore_user_account", {
                p_user_id: userId,
            });
            if (error) {
                const message =
                    (error as { message?: string })?.message ??
                    JSON.stringify(error);
                throw new Error(`restore_user_account RPC failed: ${message}`);
            }

            type RestoreResult = {
                restored?: boolean;
            } | null;
            const result = data as RestoreResult;
            if (!result?.restored) {
                throw new Error(
                    "restore_user_account RPC returned unexpected payload",
                );
            }

            // 2) BANを解除
            try {
                await admin.auth.admin.updateUserById(userId, {
                    ban_duration: "none" as unknown as string,
                } as unknown as { ban_duration: string });
            } catch {
                // noop: BAN解除失敗は致命的でない
            }
            return { restored: true };
        } catch (err: unknown) {
            if (err instanceof Error) {
                throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
            }
            throw new HttpException("Unknown error", HttpStatus.BAD_REQUEST);
        }
    }

    private createAdminRpcInvoker(): RpcInvoker {
        const admin = this.supabaseReq.getAdminClient();
        return admin.rpc.bind(admin) as unknown as RpcInvoker;
    }

    // プロフィール更新
    async updateEmail(userId: string, newEmail: string) {
        const sb = this.supabaseReq.getClient();

        const { data, error } = await sb.auth.updateUser({ email: newEmail });
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }

        const { error: upErr } = await sb
            .from("users")
            .update({
                email: newEmail,
            })
            .eq("id", userId);
        if (upErr) {
            throw new HttpException(upErr.message, HttpStatus.BAD_REQUEST);
        }
        return data;
    }

    async updateUsername(userId: string, newUsername: string) {
        const sb = this.supabaseReq.getClient();

        const { data, error } = await sb.auth.updateUser({
            data: { username: newUsername },
        });
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }

        const { error: upErr } = await sb
            .from("users")
            .update({ username: newUsername })
            .eq("id", userId);
        if (upErr) {
            throw new HttpException(upErr.message, HttpStatus.BAD_REQUEST);
        }
        return data;
    }

    async updatePassword(
        userId: string,
        userEmail: string,
        oldPw: string,
        newPw: string,
    ) {
        const lockKey = `user-password-update:${userId}`;
        const lockId = await this.lockService.acquire(lockKey, 5000); // 5秒のロックタイムアウト

        if (!lockId) {
            throw new HttpException(
                "Could not acquire lock for password update. Please try again later.",
                HttpStatus.CONFLICT,
            );
        }

        try {
            const SUPABASE_URL = this.cfg.get<string>("SUPABASE_URL");
            const SUPABASE_ANON_KEY = this.cfg.get<string>("SUPABASE_ANON_KEY");

            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                throw new HttpException(
                    "Supabase environment variables are not set.",
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }

            // 専用クライアントでアトミックに処理
            const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { autoRefreshToken: false, persistSession: false },
            });

            try {
                // 1. 認証
                const { data: signInRes, error: signErr } =
                    await tempClient.auth.signInWithPassword({
                        email: userEmail,
                        password: oldPw,
                    });

                if (signErr) {
                    // 認証情報が間違っている場合は、より汎用的なメッセージを返すのが望ましい場合もある
                    throw new HttpException(
                        "Invalid credentials provided.",
                        HttpStatus.UNAUTHORIZED,
                    );
                }

                if (signInRes.user?.id !== userId) {
                    // このエラーは、認証されたユーザーと操作対象のユーザーが異なるという深刻な状態を示す
                    // ログに記録するなど、追加の監視が望ましい
                    throw new HttpException(
                        "User mismatch after authentication.",
                        HttpStatus.FORBIDDEN,
                    );
                }

                // 2. 同じクライアントで即座にパスワード更新
                const { data, error } = await tempClient.auth.updateUser({
                    password: newPw,
                });

                if (error) {
                    throw new HttpException(
                        error.message,
                        HttpStatus.BAD_REQUEST,
                    );
                }

                return data;
            } finally {
                // 3. 処理の成否にかかわらず、必ずセッションをクリア
                await tempClient.auth.signOut();
            }
        } finally {
            await this.lockService.release(lockKey, lockId);
        }
    }

    // パスワードリセット
    async forgotPassword(email: string, redirectUrl: string) {
        const sb = this.supabaseReq.getClient();
        const { data, error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl,
        });
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        return data;
    }

    async resetPassword(accessToken: string, newPw: string) {
        const sb = this.supabaseReq.getClient();

        // 1. OTP検証を実行
        const { data: verifyData, error: verifyError } =
            await sb.auth.verifyOtp({
                token_hash: accessToken,
                type: "recovery",
            });

        if (verifyError) {
            throw new HttpException(
                "Invalid or expired reset token",
                HttpStatus.UNAUTHORIZED,
            );
        }

        // 2. 検証成功後のセッション設定
        await sb.auth.setSession({
            access_token: verifyData.session?.access_token || "",
            refresh_token: verifyData.session?.refresh_token || "",
        });

        // 3. パスワード更新
        const { data, error } = await sb.auth.updateUser({ password: newPw });
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }

        return data;
    }

    // メールアドレス確認
    async verifyEmail(email: string, token: string) {
        const sb = this.supabaseReq.getClient();
        const { data, error } = await sb.auth.verifyOtp({
            email,
            token,
            type: "email",
        });
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        return data;
    }

    // TOTP
    async verifyTotp(factorId: string, code: string) {
        const sb = this.supabaseReq.getClient();

        const { data: challenge, error: chErr } = await sb.auth.mfa.challenge({
            factorId,
        });
        if (chErr || !challenge) {
            throw new HttpException(
                chErr?.message ?? "Challenge failed",
                HttpStatus.BAD_REQUEST,
            );
        }

        const { data, error } = await sb.auth.mfa.verify({
            factorId,
            challengeId: challenge.id,
            code,
        });
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        return data;
    }
    // TOTP: enroll（QR/URI返却）
    async enrollTotp(
        _displayName?: string,
    ): Promise<{ id: string; otpauthUri: string }> {
        const sb = this.supabaseReq.getClient();
        const { data, error } = await sb.auth.mfa.enroll({
            factorType: "totp",
        });
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        const d = data as unknown as {
            id?: string;
            totp?: {
                qr_code?: string;
                qr_code_svg?: string;
                uri?: string;
            };
        };
        const factorId = d.id ?? "";
        // 返却する otpauthUri は otpauth URI を優先（フロントで QR 生成可能）
        const otpauthUri =
            d.totp?.uri ?? d.totp?.qr_code ?? d.totp?.qr_code_svg ?? "";
        if (!factorId || !otpauthUri) {
            throw new HttpException(
                "Failed to enroll TOTP factor",
                HttpStatus.BAD_REQUEST,
            );
        }
        return { id: factorId, otpauthUri };
    }

    // TOTP: disable（unenroll）
    async disableTotp(factorId: string) {
        const sb = this.supabaseReq.getClient();
        const { data, error } = await sb.auth.mfa.unenroll({ factorId });
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        return data;
    }

    /* ------------------------------------------------------------------
     * WebAuthn (パスキー) 関連
     * ------------------------------------------------------------------ */
    // 1. 登録開始: PublicKeyCredentialCreationOptions を取得
    async startWebAuthnRegistration(displayName?: string) {
        const sb = this.supabaseReq.getClient();
        // `@supabase/supabase-js` v2.x では型定義に "webauthn" が含まれていないため
        // 明示的に型アサーションしてコンパイラエラーを回避する
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const { data, error } = await sb.auth.mfa.enroll({
            factorType: "webauthn",
            friendlyName: displayName,
        } as unknown as Parameters<typeof sb.auth.mfa.enroll>[0]);
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        return data as Record<string, unknown>;
    }

    // 2. 登録完了: attestationResponse を検証
    async finishWebAuthnRegistration(
        attestationResponse: Record<string, unknown>,
    ) {
        const sb = this.supabaseReq.getClient();
        // WebAuthn 登録完了（attestation）の型定義も存在しないため同様にキャスト
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const { data, error } = await sb.auth.mfa.verify({
            attestationResponse,
        } as unknown as Parameters<typeof sb.auth.mfa.verify>[0]);
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        return data;
    }

    // 3. 認証検証: assertionResponse を検証
    async verifyWebAuthnAssertion(assertionResponse: Record<string, unknown>) {
        const sb = this.supabaseReq.getClient();
        // WebAuthn 認証（assertion）の検証
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const { data, error } = await sb.auth.mfa.verify({
            assertionResponse,
        } as unknown as Parameters<typeof sb.auth.mfa.verify>[0]);
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
        return data;
    }

    // リフレッシュトークンからアクセストークンを再発行
    async refreshAccessToken(refreshToken: string) {
        const sb = this.supabaseReq.getClient();
        // v2のAuth API: refreshSession({ refresh_token }) を利用
        const { data, error } = await sb.auth.refreshSession({
            refresh_token: refreshToken,
        });
        if (error) {
            throw new HttpException(error.message, HttpStatus.UNAUTHORIZED);
        }
        const access_token = data.session?.access_token ?? "";
        const refresh_token = data.session?.refresh_token ?? undefined;
        if (!access_token) {
            throw new HttpException(
                "Failed to refresh access token",
                HttpStatus.UNAUTHORIZED,
            );
        }
        return { access_token, refresh_token };
    }
}
