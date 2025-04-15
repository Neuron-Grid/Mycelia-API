import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class VerifyTotpDto {
    @ApiProperty({ example: 'totp_factor_id', description: 'TOTP factor ID' })
    @IsString()
    @IsNotEmpty()
    factorId: string

    @ApiProperty({ example: '123456', description: 'TOTP verification code' })
    @IsString()
    @IsNotEmpty()
    code: string
}
