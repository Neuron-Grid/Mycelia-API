import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class ResetPasswordDto {
    @ApiProperty({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'Access token from password reset email',
    })
    @IsString()
    accessToken: string

    @ApiProperty({ example: 'newPassword123', description: 'New password (min length = 8)' })
    @IsString()
    @MinLength(8)
    newPassword: string
}
