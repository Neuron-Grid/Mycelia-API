import { IsEmail, IsString, MinLength } from "class-validator";

export class SignInDto {
    /** User email address */
    @IsEmail()
    email: string;

    /** User password (min length = 8) */
    @IsString()
    @MinLength(8)
    password: string;
}
