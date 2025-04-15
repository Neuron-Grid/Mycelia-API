import { ApiProperty } from '@nestjs/swagger'
import { IsEmail } from 'class-validator'

export class UpdateEmailDto {
    @ApiProperty({ example: 'newemail@example.com', description: 'New email address' })
    @IsEmail()
    newEmail: string
}
