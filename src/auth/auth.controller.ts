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
import { SupabaseAuthGuard } from './supabase-auth.guard'
import { SupabaseUser } from './supabase-user.decorator'

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // 認証不要のルート
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

    @Post('verify-email')
    async verifyEmail(@Body() body: { email: string; token: string }) {
        try {
            const { email, token } = body
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
    async updateEmail(@SupabaseUser() user: User, @Body() body: { newEmail: string }) {
        try {
            if (!user) {
                throw new HttpException('No authenticated user', HttpStatus.UNAUTHORIZED)
            }
            const result = await this.authService.updateEmail(user, body.newEmail)
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
    async updateUsername(@SupabaseUser() user: User, @Body() body: { newUsername: string }) {
        try {
            if (!user) {
                throw new HttpException('No authenticated user', HttpStatus.UNAUTHORIZED)
            }
            const result = await this.authService.updateUsername(user, body.newUsername)
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
    async updatePassword(
        @SupabaseUser() user: User,
        @Body() body: { oldPassword: string; newPassword: string },
    ) {
        try {
            if (!user) {
                throw new HttpException('No authenticated user', HttpStatus.UNAUTHORIZED)
            }
            const { oldPassword, newPassword } = body
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
}
