import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString } from 'class-validator'

export class VerifyEmailDto {
    @ApiProperty({ example: 'user@example.com', description: 'Email address to verify' })
    @IsEmail()
    email: string

    @ApiProperty({ example: 'verification_token_123', description: 'Email verification token' })
    @IsString()
    token: string
}
