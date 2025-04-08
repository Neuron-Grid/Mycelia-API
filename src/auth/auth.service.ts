import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { SupabaseRequestService } from 'src/supabase-request.service'

@Injectable()
export class AuthService {
    constructor(private readonly supabaseRequestService: SupabaseRequestService) {}

    // 新規ユーザー登録
    async signUp(email: string, password: string) {
        // Anon Key を使うクライアント
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase.auth.signUp({ email, password })
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
    // Service Role Key 使用
    async deleteAccount(userId: string) {
        // Service Role Key を使うクライアント
        const supabaseAdmin = this.supabaseRequestService.getAdminClient()
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
        return data
    }
}
