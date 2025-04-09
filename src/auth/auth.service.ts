import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { SupabaseRequestService } from 'src/supabase-request.service'

@Injectable()
export class AuthService {
    constructor(private readonly supabaseRequestService: SupabaseRequestService) {}

    // 新規ユーザー登録
    async signUp(email: string, password: string, username: string) {
        const supabase = this.supabaseRequestService.getClient()

        // public.users を検索して email が既に存在しないかチェック
        // single()を使うと、存在しない場合 data=null、存在すれば data=<object> が返る。
        const { data: existingEmailUser, error: emailCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single()

        if (emailCheckError && emailCheckError.code !== 'PGRST116') {
            // "PGRST116" は "No rows found" に関連するエラー。
            // それ以外は想定外エラーとみなし、throw しておく。
            throw new HttpException(emailCheckError.message, HttpStatus.INTERNAL_SERVER_ERROR)
        }
        if (existingEmailUser) {
            // すでにメールアドレスが使われている
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

        // 重複していないのでSupabase Authでユーザー作成を行う
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

    // メールアドレスを更新する
    // ログインユーザー自身が呼ぶ想定で、headerに付与されたトークンからユーザーIDを特定し更新する
    async updateEmail(newEmail: string) {
        const supabase = this.supabaseRequestService.getClient()

        // 現在認証中のユーザー情報を取得
        const {
            data: { user },
            error: getUserError,
        } = await supabase.auth.getUser()
        if (getUserError || !user) {
            throw new HttpException(
                getUserError?.message ?? 'User not found in session',
                HttpStatus.UNAUTHORIZED,
            )
        }

        // 変更前後でメールアドレスが同じ場合はスキップ
        if (user.email === newEmail) {
            return { message: 'Email is already set to the provided address' }
        }

        // public.users 側で既に同じメールが存在しないかチェック
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

        // Supabase Auth 側のメールアドレスを更新
        const { data, error } = await supabase.auth.updateUser({
            email: newEmail,
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }

        // public.users 側の email カラムを更新
        const { error: updateUserError } = await supabase
            .from('users')
            .update({ email: newEmail })
            .eq('id', user.id)
        if (updateUserError) {
            throw new HttpException(updateUserError.message, HttpStatus.BAD_REQUEST)
        }

        return data
    }

    // ユーザー名を更新する
    // ログインユーザー自身が呼ぶ想定で、headerに付与されたトークンからユーザーIDを特定し更新する
    async updateUsername(newUsername: string) {
        const supabase = this.supabaseRequestService.getClient()

        const {
            data: { user },
            error: getUserError,
        } = await supabase.auth.getUser()
        if (getUserError || !user) {
            throw new HttpException(
                getUserError?.message ?? 'User not found in session',
                HttpStatus.UNAUTHORIZED,
            )
        }

        // 変更前後でユーザー名が同じ場合はスキップ
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

        // Supabase Auth (metadata) 側を更新
        const { data, error } = await supabase.auth.updateUser({
            data: {
                username: newUsername,
            },
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }

        // public.users側のusernameカラムを更新
        const { error: updateUserError } = await supabase
            .from('users')
            .update({ username: newUsername })
            .eq('id', user.id)
        if (updateUserError) {
            throw new HttpException(updateUserError.message, HttpStatus.BAD_REQUEST)
        }

        return data
    }

    // パスワードを更新する
    // 古いパスワードで再認証してから新しいパスワードに更新する
    async updatePassword(oldPassword: string, newPassword: string) {
        const supabase = this.supabaseRequestService.getClient()

        // まずは旧パスワードで再ログインしてユーザーを検証
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: (await supabase.auth.getUser()).data.user?.email ?? '',
            password: oldPassword,
        })

        if (signInError) {
            throw new HttpException('Old password is incorrect', HttpStatus.UNAUTHORIZED)
        }

        // 再ログインが成功したら、パスワードを更新
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword,
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }

        return data
    }

    // パスワードリセット要求
    // Supabaseの機能のresetPasswordForEmailを利用してメールを送る。
    // 送られるメール内のリンク先はプロジェクトのAuth設定に従う。
    async forgotPassword(email: string) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            // オプション：リダイレクト先を指定する場合など
            redirectTo: 'https://example.com/reset-password',
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }

    // リセットリンク経由で新パスワードを適用
    // resetPasswordForEmailで送られたリンクを踏んだ後、
    // クライアントがSupabaseから受け取るアクセストークン(accessToken)を用いて、パスワード更新を行う
    async resetPassword(accessToken: string, newPassword: string) {
        // Service Role Keyを利用してもよいが、通常はアクセストークンで十分
        const supabase = this.supabaseRequestService.getClient()

        // 一時的にアクセストークンを使ったSupabaseClientを再生成する方法
        // （単純にヘッダーを差し替えるだけでもOK）
        const tempClient = supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: '',
        })

        // これでlogged inと同様の状態になるので、updateUserできる
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword,
        })
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }

        return data
    }
}
