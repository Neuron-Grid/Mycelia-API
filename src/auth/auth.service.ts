import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { User } from '@supabase/supabase-js'
import { SupabaseRequestService } from 'src/supabase-request.service'

@Injectable()
export class AuthService {
    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        private readonly configService: ConfigService,
    ) {}

    // 新規ユーザー登録
    async signUp(email: string, password: string, username: string) {
        const supabase = this.supabaseRequestService.getClient()

        // public.users を指定し、型引数は使わない
        const { data: existingEmailUser, error: emailCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single()

        if (emailCheckError && emailCheckError.code !== 'PGRST116') {
            throw new HttpException(emailCheckError.message, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        if (existingEmailUser) {
            throw new HttpException('That email is already in use.', HttpStatus.CONFLICT)
        }

        // usernameの重複チェック
        const { data: existingUsernameUser, error: usernameCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single()

        if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
            throw new HttpException(usernameCheckError.message, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        if (existingUsernameUser) {
            throw new HttpException('That username is already in use.', HttpStatus.CONFLICT)
        }

        // Supabase Authでユーザー作成
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username },
            },
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    // ログイン
    async signIn(email: string, password: string) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.UNAUTHORIZED)
        }
        return data
    }

    // ログアウト
    async signOut() {
        const supabase = this.supabaseRequestService.getClient()
        const { error } = await supabase.auth.signOut()
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return { message: 'Signed out' }
    }

    // アカウント削除
    async deleteAccount(userId: string) {
        const supabaseAdmin = this.supabaseRequestService.getAdminClient()
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    // メールアドレス更新
    async updateEmail(user: User, newEmail: string) {
        const supabase = this.supabaseRequestService.getClient()

        if (user.email === newEmail) {
            return { message: 'Email is already set to the provided address' }
        }

        // 同じメールがないか
        const { data: existingUser, error: emailCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('email', newEmail)
            .single()

        if (emailCheckError && emailCheckError.code !== 'PGRST116') {
            throw new HttpException(emailCheckError.message, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        if (existingUser) {
            throw new HttpException('This email is already in use.', HttpStatus.CONFLICT)
        }

        // Supabase Auth側
        const { data, error } = await supabase.auth.updateUser({ email: newEmail })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }

        // public.users側
        const { error: updateUserError } = await supabase
            .from('users')
            .update({ email: newEmail })
            .eq('id', user.id)

        if (updateUserError) {
            throw new HttpException(updateUserError.message, HttpStatus.BAD_REQUEST)
        }

        return data
    }

    // ユーザー名更新
    async updateUsername(user: User, newUsername: string) {
        const supabase = this.supabaseRequestService.getClient()

        // 変更前後が同じかチェック
        const { data: publicUser } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .single()

        if (publicUser && publicUser.username === newUsername) {
            return { message: 'Username is already set to the provided name' }
        }

        // 重複チェック
        const { data: existingUser, error: usernameCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('username', newUsername)
            .single()

        if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
            throw new HttpException(usernameCheckError.message, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        if (existingUser) {
            throw new HttpException('This username is already in use.', HttpStatus.CONFLICT)
        }

        // Auth metadata
        const { data, error } = await supabase.auth.updateUser({
            data: { username: newUsername },
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }

        // public.users 側
        const { error: updateUserError } = await supabase
            .from('users')
            .update({ username: newUsername })
            .eq('id', user.id)

        if (updateUserError) {
            throw new HttpException(updateUserError.message, HttpStatus.BAD_REQUEST)
        }

        return data
    }

    // パスワード更新
    async updatePassword(user: User, oldPassword: string, newPassword: string) {
        const supabase = this.supabaseRequestService.getClient()

        // 旧パスワードでログインして検証
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email ?? '',
            password: oldPassword,
        })
        if (signInError) {
            throw new HttpException('Old password is incorrect', HttpStatus.UNAUTHORIZED)
        }

        // パスワード更新
        const { data, error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    // パスワードリセット要求
    async forgotPassword(email: string) {
        const supabase = this.supabaseRequestService.getClient()
        const domain = this.configService.get<string>('PRODUCTION_DOMAIN') ?? 'example.com'
        const resetUrl = `https://${domain}/reset-password`

        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetUrl,
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    // リセットリンク経由で新パスワード適用
    async resetPassword(accessToken: string, newPassword: string) {
        const supabase = this.supabaseRequestService.getClient()

        await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: '',
        })

        const { data, error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    // メール確認
    async verifyEmail(email: string, token: string) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email',
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }
}
