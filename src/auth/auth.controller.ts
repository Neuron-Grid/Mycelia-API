import { Body, Controller, Delete, HttpException, HttpStatus, Patch, Post } from '@nestjs/common'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // 新規アカウント登録
    @Post('signup')
    async signUp(@Body() body: { email: string; password: string; username: string }) {
        try {
            const { email, password, username } = body
            const result = await this.authService.signUp(email, password, username)
            return {
                message: 'Signup successful',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // ログイン
    @Post('login')
    async signIn(@Body() body: { email: string; password: string }) {
        try {
            const { email, password } = body
            const result = await this.authService.signIn(email, password)
            return {
                message: 'Login successful',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.UNAUTHORIZED)
        }
    }

    // ログアウト
    @Post('logout')
    async signOut() {
        try {
            const result = await this.authService.signOut()
            return {
                message: 'Logout successful',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // アカウント削除
    @Delete('delete')
    async deleteAccount(@Body() body: { userId: string }) {
        try {
            const { userId } = body
            const result = await this.authService.deleteAccount(userId)
            return {
                message: 'Account deleted',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // ===========================
    //  以下が新たに追加するAPI
    // ===========================

    // [A] メールアドレス変更
    @Patch('update-email')
    async updateEmail(@Body() body: { newEmail: string }) {
        try {
            const { newEmail } = body
            const result = await this.authService.updateEmail(newEmail)
            return {
                message: 'Email updated successfully',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // [B] ユーザー名変更
    @Patch('update-username')
    async updateUsername(@Body() body: { newUsername: string }) {
        try {
            const { newUsername } = body
            const result = await this.authService.updateUsername(newUsername)
            return {
                message: 'Username updated successfully',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // [C] パスワード変更
    @Patch('update-password')
    async updatePassword(@Body() body: { oldPassword: string; newPassword: string }) {
        try {
            const { oldPassword, newPassword } = body
            const result = await this.authService.updatePassword(oldPassword, newPassword)
            return {
                message: 'Password updated successfully',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // [D] パスワードリセット要求（「パスワードを忘れた」時のフロー）
    //     Supabaseが送信するパスワード再設定用のメールをトリガーする
    @Post('forgot-password')
    async forgotPassword(@Body() body: { email: string }) {
        try {
            const { email } = body
            const result = await this.authService.forgotPassword(email)
            return {
                message: 'Password reset email sent',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // リセットリンクから遷移したあとに、新しいパスワードを入力してもらう想定のAPI例
    // ※ 実際にはフロント(クライアント)サイドで supabase.auth.updateUser() を行いがちですが、
    //   サーバーサイドで行う場合の例として示しています
    @Post('reset-password')
    async resetPassword(@Body() body: { accessToken: string; newPassword: string }) {
        try {
            const { accessToken, newPassword } = body
            const result = await this.authService.resetPassword(accessToken, newPassword)
            return {
                message: 'Password has been reset',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }
}
