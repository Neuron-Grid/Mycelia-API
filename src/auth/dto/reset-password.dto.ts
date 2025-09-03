import { IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
    /** Access token from password reset email */
    @IsString()
    accessToken: string;

    /** New password (min length = 8) */
    @IsString()
    @MinLength(8)
    newPassword: string;
}
