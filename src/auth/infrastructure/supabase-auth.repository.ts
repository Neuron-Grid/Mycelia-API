import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import { DistributedLockService } from 'src/shared/lock/distributed-lock.service'
import { SupabaseRequestService } from 'src/supabase-request.service'
import { AuthRepositoryPort } from '../domain/auth.repository'

@Injectable()
export class SupabaseAuthRepository implements AuthRepositoryPort {
    constructor(
        private readonly supabaseReq: SupabaseRequestService,
        private readonly lockService: DistributedLockService,
    ) {}

    // ... (other methods remain the same) ...
    async signUp(email: string, password: string, username: string) {
        const sb = this.supabaseReq.getClient()
        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: { data: { username } },
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    async signIn(email: string, password: string) {
        const sb = this.supabaseReq.getClient()
        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password,
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.UNAUTHORIZED)
        }
        return data
    }

    async signOut(): Promise<void> {
        const sb = this.supabaseReq.getClient()
        const { error } = await sb.auth.signOut()
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // アカウント削除
    // RLSバイパス
    async deleteAccount(userId: string) {
        try {
            return await this.supabaseReq.deleteUserAccount(userId)
        } catch (err: unknown) {
            if (err instanceof Error) {
                throw new HttpException(err.message, HttpStatus.BAD_REQUEST)
            }
            throw new HttpException('Unknown error', HttpStatus.BAD_REQUEST)
        }
    }

    // プロフィール更新
    async updateEmail(userId: string, newEmail: string) {
        const sb = this.supabaseReq.getClient()

        const { data, error } = await sb.auth.updateUser({ email: newEmail })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }

        const { error: upErr } = await sb
            .from('users')
            .update({
                email: newEmail,
            })
            .eq('id', userId)
        if (upErr) {
            throw new HttpException(upErr.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    async updateUsername(userId: string, newUsername: string) {
        const sb = this.supabaseReq.getClient()

        const { data, error } = await sb.auth.updateUser({
            data: { username: newUsername },
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }

        const { error: upErr } = await sb
            .from('users')
            .update({ username: newUsername })
            .eq('id', userId)
        if (upErr) {
            throw new HttpException(upErr.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    async updatePassword(userId: string, userEmail: string, oldPw: string, newPw: string) {
        const lockKey = `user-password-update:${userId}`
        const lockId = await this.lockService.acquire(lockKey, 5000) // 5秒のロックタイムアウト

        if (!lockId) {
            throw new HttpException(
                'Could not acquire lock for password update. Please try again later.',
                HttpStatus.CONFLICT,
            )
        }

        try {
            const SUPABASE_URL = process.env.SUPABASE_URL
            const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                throw new HttpException(
                    'Supabase environment variables are not set.',
                    HttpStatus.INTERNAL_SERVER_ERROR,
                )
            }

            // 専用クライアントでアトミックに処理
            const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { autoRefreshToken: false, persistSession: false },
            })

            try {
                // 1. 認証
                const { data: signInRes, error: signErr } =
                    await tempClient.auth.signInWithPassword({
                        email: userEmail,
                        password: oldPw,
                    })

                if (signErr) {
                    // 認証情報が間違っている場合は、より汎用的なメッセージを返すのが望ましい場合もある
                    throw new HttpException(
                        'Invalid credentials provided.',
                        HttpStatus.UNAUTHORIZED,
                    )
                }

                if (signInRes.user?.id !== userId) {
                    // このエラーは、認証されたユーザーと操作対象のユーザーが異なるという深刻な状態を示す
                    // ログに記録するなど、追加の監視が望ましい
                    throw new HttpException(
                        'User mismatch after authentication.',
                        HttpStatus.FORBIDDEN,
                    )
                }

                // 2. 同じクライアントで即座にパスワード更新
                const { data, error } = await tempClient.auth.updateUser({ password: newPw })

                if (error) {
                    throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
                }

                return data
            } finally {
                // 3. 処理の成否にかかわらず、必ずセッションをクリア
                await tempClient.auth.signOut()
            }
        } finally {
            await this.lockService.release(lockKey, lockId)
        }
    }

    // パスワードリセット
    async forgotPassword(email: string, redirectUrl: string) {
        const sb = this.supabaseReq.getClient()
        const { data, error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl,
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    async resetPassword(accessToken: string, newPw: string) {
        const sb = this.supabaseReq.getClient()

        // 1. OTP検証を実行
        const { data: verifyData, error: verifyError } = await sb.auth.verifyOtp({
            token_hash: accessToken,
            type: 'recovery',
        })

        if (verifyError) {
            throw new HttpException('Invalid or expired reset token', HttpStatus.UNAUTHORIZED)
        }

        // 2. 検証成功後のセッション設定
        await sb.auth.setSession({
            access_token: verifyData.session?.access_token || '',
            refresh_token: verifyData.session?.refresh_token || '',
        })

        // 3. パスワード更新
        const { data, error } = await sb.auth.updateUser({ password: newPw })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }

        return data
    }

    // メールアドレス確認
    async verifyEmail(email: string, token: string) {
        const sb = this.supabaseReq.getClient()
        const { data, error } = await sb.auth.verifyOtp({
            email,
            token,
            type: 'email',
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    // TOTP
    async verifyTotp(factorId: string, code: string) {
        const sb = this.supabaseReq.getClient()

        const { data: challenge, error: chErr } = await sb.auth.mfa.challenge({
            factorId,
        })
        if (chErr || !challenge) {
            throw new HttpException(chErr?.message ?? 'Challenge failed', HttpStatus.BAD_REQUEST)
        }

        const { data, error } = await sb.auth.mfa.verify({
            factorId,
            challengeId: challenge.id,
            code,
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }
}
