import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common'
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
import { SupabaseAuthGuard } from './supabase-auth.guard'
import { SupabaseUser } from './supabase-user.decorator'

@Controller({
    path: 'auth',
    version: '1',
})
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // 認証不要のルート
    @Post('signup')
    async signUp(@Body() signUpDto: SignUpDto) {
        try {
            const { email, password, username } = signUpDto
            const result = await this.authService.signUp(email, password, username)
            return {
                message: 'Signup successful',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    @Post('login')
    async signIn(@Body() signInDto: SignInDto) {
        try {
            const { email, password } = signInDto
            const result = await this.authService.signIn(email, password)
            return {
                message: 'Login successful',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.UNAUTHORIZED)
        }
    }

    @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        try {
            const { email } = dto
            const result = await this.authService.forgotPassword(email)
            return {
                message: 'Password reset email sent',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    @Post('reset-password')
    async resetPassword(@Body() dto: ResetPasswordDto) {
        try {
            const { accessToken, newPassword } = dto
            const result = await this.authService.resetPassword(accessToken, newPassword)
            return {
                message: 'Password has been reset',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    @Post('verify-email')
    async verifyEmail(@Body() dto: VerifyEmailDto) {
        try {
            const { email, token } = dto
            const result = await this.authService.verifyEmail(email, token)
            return {
                message: 'Email verified successfully',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    // 認証必須のルート
    @UseGuards(SupabaseAuthGuard)
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

    @UseGuards(SupabaseAuthGuard)
    @Delete('delete')
    async deleteAccount(@SupabaseUser() user: User) {
        try {
            if (!user?.id) {
                throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED)
            }
            const result = await this.authService.deleteAccount(user.id)
            return {
                message: 'Account deleted',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    @UseGuards(SupabaseAuthGuard)
    @Patch('update-email')
    async updateEmail(@SupabaseUser() user: User, @Body() dto: UpdateEmailDto) {
        try {
            if (!user) {
                throw new HttpException('No authenticated user', HttpStatus.UNAUTHORIZED)
            }
            const result = await this.authService.updateEmail(user, dto.newEmail)
            return {
                message: 'Email updated successfully',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    @UseGuards(SupabaseAuthGuard)
    @Patch('update-username')
    async updateUsername(@SupabaseUser() user: User, @Body() dto: UpdateUsernameDto) {
        try {
            if (!user) {
                throw new HttpException('No authenticated user', HttpStatus.UNAUTHORIZED)
            }
            const result = await this.authService.updateUsername(user, dto.newUsername)
            return {
                message: 'Username updated successfully',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    @UseGuards(SupabaseAuthGuard)
    @Patch('update-password')
    async updatePassword(@SupabaseUser() user: User, @Body() dto: UpdatePasswordDto) {
        try {
            if (!user) {
                throw new HttpException('No authenticated user', HttpStatus.UNAUTHORIZED)
            }
            const { oldPassword, newPassword } = dto
            const result = await this.authService.updatePassword(user, oldPassword, newPassword)
            return {
                message: 'Password updated successfully',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }

    @UseGuards(SupabaseAuthGuard)
    @Get('profile')
    getProfile(@SupabaseUser() user: User) {
        return {
            message: 'User profile fetched successfully',
            data: user,
        }
    }

    @Post('verify-totp')
    async verifyTotp(@Body() dto: VerifyTotpDto) {
        try {
            // dto内に factorId, code がある想定
            const { factorId, code } = dto
            const result = await this.authService.verifyTotp(factorId, code)
            return {
                message: 'TOTP verified successfully',
                data: result,
            }
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
        }
    }
}
