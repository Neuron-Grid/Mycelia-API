import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class SignUpDto {
    /** User email address */
    @IsEmail()
    @MaxLength(100)
    email: string;

    /** User password (min length = 8) */
    @IsString()
    @MinLength(8)
    password: string;

    /** Display name for the user */
    @IsString()
    @MaxLength(100)
    username: string;
}
