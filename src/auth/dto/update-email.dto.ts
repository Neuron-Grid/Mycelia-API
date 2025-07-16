import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class UpdateEmailDto {
    @ApiProperty({ example: 'newemail@example.com', description: 'New email address' })
    @IsEmail()
    @MaxLength(100)
    newEmail: string;
}
