import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class UpdateUsernameDto {
    @ApiProperty({ example: 'newUsername', description: 'New username' })
    @IsString()
    newUsername: string
}
