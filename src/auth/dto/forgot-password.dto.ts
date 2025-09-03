import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
    /** Email address for password reset */
    @IsEmail()
    email: string;
}
