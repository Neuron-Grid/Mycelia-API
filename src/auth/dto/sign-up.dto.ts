import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class SignUpDto {
    @ApiProperty({
        example: "user@example.com",
        description: "User email address",
    })
    @IsEmail()
    @MaxLength(100)
    email: string;

    @ApiProperty({
        example: "password123",
        description: "User password (min length = 8)",
    })
    @IsString()
    @MinLength(8)
    password: string;

    @ApiProperty({
        example: "myusername",
        description: "Display name for the user",
    })
    @IsString()
    @MaxLength(100)
    username: string;
}
