import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
    @ApiProperty({ example: 'currentPassword123', description: 'Current password' })
    @IsString()
    oldPassword: string;

    @ApiProperty({ example: 'newPassword456', description: 'New password (min length = 8)' })
    @IsString()
    @MinLength(8)
    newPassword: string;
}
