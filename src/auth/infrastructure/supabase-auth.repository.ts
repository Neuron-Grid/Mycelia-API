import { AuthAccountDeletionService } from "@/auth/application/auth-account-deletion.service";
import {
    APP_ENV_TOKEN,
    type AppEnv,
    type SupabaseConfig,
} from "@/config/app-env";
import { DistributedLockService } from "@/shared/lock/distributed-lock.service";
import { SupabaseRequestService } from "@/supabase-request.service";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import { AuthRepositoryPort } from "../domain/auth.repository";

@Injectable()
export class SupabaseAuthRepository implements AuthRepositoryPort {
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Supabase configuration is consumed in password update logic but Biome fails to trace.
    private readonly supabaseConfig: SupabaseConfig;

    constructor(
        private readonly supabaseReq: SupabaseRequestService,
        private readonly lockService: DistributedLockService,
        private readonly accountDeletionService: AuthAccountDeletionService,
        // biome-ignore lint/correctness/noUnusedPrivateClassMembers: AppEnv injection is required to resolve runtime Supabase credentials.
        @Inject(APP_ENV_TOKEN) private readonly appEnv: AppEnv,
    ) {
        this.supabaseConfig = this.appEnv.getSupabaseConfig();
    }

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
        try {
            const signOutSession = async () => {
                const sb = this.supabaseReq.getClient();
                await sb.auth.signOut();
            };
            return await this.accountDeletionService.execute(userId, {
                operatorId: userId,
                signOutSession,
            });
        } catch (err: unknown) {
            if (err instanceof Error) {
                throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
            }
            throw new HttpException("Unknown error", HttpStatus.BAD_REQUEST);
        }
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
            const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } =
                this.supabaseConfig;

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

    //  WebAuthn (パスキー) 関連
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
