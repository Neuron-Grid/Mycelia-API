import { IsEmail, IsString } from "class-validator";

export class VerifyEmailDto {
    /** Email address to verify */
    @IsEmail()
    email: string;

    /** Email verification token */
    @IsString()
    token: string;
}
