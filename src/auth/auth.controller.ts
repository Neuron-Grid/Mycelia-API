// @file 認証・ユーザー管理APIのコントローラ
import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common'
// @see https://docs.nestjs.com/openapi/introduction
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
// @see https://supabase.com/docs/reference/javascript/auth-api
import { User } from '@supabase/supabase-js'
import { AuthService } from './auth.service'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { SignInDto } from './dto/sign-in.dto'
import { SignUpDto } from './dto/sign-up.dto'
import { UpdateEmailDto } from './dto/update-email.dto'
import { UpdatePasswordDto } from './dto/update-password.dto'
import { UpdateUsernameDto } from './dto/update-username.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'
import { VerifyTotpDto } from './dto/verify-totp.dto'
import { buildResponse } from './response.util'
import { SupabaseAuthGuard } from './supabase-auth.guard'
import { SupabaseUser } from './supabase-user.decorator'
import { UserId } from './user-id.decorator'

@ApiTags('Authentication')
@Controller({
    path: 'auth',
    version: '1',
})
// @public
// @since 1.0.0
export class AuthController {
    // @param {AuthService} authService - 認証サービス
    // @since 1.0.0
    // @public
    constructor(private readonly authService: AuthService) {}

    // @async
    // @public
    // @since 1.0.0
    // @param {SignUpDto} signUpDto - ユーザー登録情報
    // @returns {Promise<unknown>} - 登録結果のレスポンス
    // @throws {HttpException} - 登録失敗時
    // @example
    // await authController.signUp({ email, password, username })
    // @see AuthService.signUp
    @Post('signup')
    async signUp(@Body() signUpDto: SignUpDto) {
        const { email, password, username } = signUpDto
        const result = await this.authService.signUp(email, password, username)
        return buildResponse('Signup successful', result)
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {SignInDto} signInDto - ログイン情報
    // @returns {Promise<unknown>} - ログイン結果のレスポンス
    // @throws {HttpException} - 認証失敗時
    // @example
    // await authController.signIn({ email, password })
    // @see AuthService.signIn
    @Post('login')
    async signIn(@Body() signInDto: SignInDto) {
        const { email, password } = signInDto
        const result = await this.authService.signIn(email, password)
        return buildResponse('Login successful', result)
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {ForgotPasswordDto} dto - パスワードリセットリクエスト情報
    // @returns {Promise<unknown>} - リセットメール送信結果のレスポンス
    // @throws {HttpException} - 送信失敗時
    // @example
    // await authController.forgotPassword({ email })
    // @see AuthService.forgotPassword
    @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        const { email } = dto
        const result = await this.authService.forgotPassword(email)
        return buildResponse('Password reset email sent', result)
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {ResetPasswordDto} dto - リセット情報
    // @returns {Promise<unknown>} - リセット処理結果のレスポンス
    // @throws {HttpException} - リセット失敗時
    // @example
    // await authController.resetPassword({ accessToken, newPassword })
    // @see AuthService.resetPassword
    @Post('reset-password')
    async resetPassword(@Body() dto: ResetPasswordDto) {
        const { accessToken, newPassword } = dto
        const result = await this.authService.resetPassword(accessToken, newPassword)
        return buildResponse('Password has been reset', result)
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {VerifyEmailDto} dto - メール認証情報
    // @returns {Promise<unknown>} - 認証処理結果のレスポンス
    // @throws {HttpException} - 認証失敗時
    // @example
    // await authController.verifyEmail({ email, token })
    // @see AuthService.verifyEmail
    @Post('verify-email')
    async verifyEmail(@Body() dto: VerifyEmailDto) {
        const { email, token } = dto
        const result = await this.authService.verifyEmail(email, token)
        return buildResponse('Email verified successfully', result)
    }

    // @async
    // @public
    // @since 1.0.0
    // @returns {Promise<unknown>} - ログアウト処理結果のレスポンス
    // @throws {HttpException} - ログアウト失敗時
    // @example
    // await authController.signOut()
    // @see AuthService.signOut
    @Post('logout')
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard)
    async signOut() {
        const result = await this.authService.signOut()
        return buildResponse('Logout successful', result)
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - 認証済みユーザー
    // @returns {Promise<unknown>} - アカウント削除処理結果のレスポンス
    // @throws {HttpException} - 削除失敗時
    // @example
    // await authController.deleteAccount(user)
    // @see AuthService.deleteAccount
    @Delete('delete')
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard)
    async deleteAccount(@UserId() userId: string) {
        const result = await this.authService.deleteAccount(userId)
        return buildResponse('Account deleted', result)
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - 認証済みユーザー
    // @param {UpdateEmailDto} dto - 新しいメールアドレス情報
    // @returns {Promise<unknown>} - メールアドレス更新処理結果のレスポンス
    // @throws {HttpException} - 更新失敗時
    // @example
    // await authController.updateEmail(user, { newEmail: 'new@example.com' })
    // @see AuthService.updateEmail
    @Patch('update-email')
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard)
    async updateEmail(@SupabaseUser() user: User, @Body() dto: UpdateEmailDto) {
        const result = await this.authService.updateEmail(user, dto.newEmail)
        return buildResponse('Email updated successfully', result)
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - 認証済みユーザー
    // @param {UpdateUsernameDto} dto - 新しいユーザー名情報
    // @returns {Promise<unknown>} - ユーザー名更新処理結果のレスポンス
    // @throws {HttpException} - 更新失敗時
    // @example
    // await authController.updateUsername(user, { newUsername: 'newname' })
    // @see AuthService.updateUsername
    @Patch('update-username')
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard)
    async updateUsername(@SupabaseUser() user: User, @Body() dto: UpdateUsernameDto) {
        const result = await this.authService.updateUsername(user, dto.newUsername)
        return buildResponse('Username updated successfully', result)
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - 認証済みユーザー
    // @param {UpdatePasswordDto} dto - パスワード更新情報
    // @returns {Promise<unknown>} - パスワード更新処理結果のレスポンス
    // @throws {HttpException} - 更新失敗時
    // @example
    // await authController.updatePassword(user, { oldPassword: 'old', newPassword: 'new' })
    // @see AuthService.updatePassword
    @Patch('update-password')
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard)
    async updatePassword(@SupabaseUser() user: User, @Body() dto: UpdatePasswordDto) {
        const { oldPassword, newPassword } = dto
        const result = await this.authService.updatePassword(user, oldPassword, newPassword)
        return buildResponse('Password updated successfully', result)
    }

    // @public
    // @since 1.0.0
    // @param {User} user - 認証済みユーザー
    // @returns {{ message: string, data: User }} - ユーザープロフィールのレスポンス
    // @example
    // authController.getProfile(user)
    @Get('profile')
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard)
    getProfile(@SupabaseUser() user: User): { message: string; data: User } {
        return buildResponse('User profile fetched successfully', user)
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {VerifyTotpDto} dto - TOTP認証情報
    // @returns {Promise<unknown>} - TOTP認証処理結果のレスポンス
    // @throws {HttpException} - 認証失敗時
    // @example
    // await authController.verifyTotp({ factorId, code })
    // @see AuthService.verifyTotp
    @Post('verify-totp')
    async verifyTotp(@Body() dto: VerifyTotpDto) {
        // dto内に factorId, code がある想定
        const { factorId, code } = dto
        const result = await this.authService.verifyTotp(factorId, code)
        return buildResponse('TOTP verified successfully', result)
    }
}
