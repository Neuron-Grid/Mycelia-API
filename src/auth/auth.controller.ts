import { Body, Controller, Delete, Headers, HttpException, HttpStatus, Post } from '@nestjs/common'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // 新規アカウント登録
    @Post('signup')
    async signUp(@Body() body: { email: string; password: string }) {
        try {
            const { email, password } = body
            const result = await this.authService.signUp(email, password)
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

    //  ログアウト
    //  - リクエストヘッダ(Authorization)に現在のセッションTokenが入っている想定
    @Post('logout')
    async signOut() {
        try {
            // サインアウトはAuthServiceで実施
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
}
