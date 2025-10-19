import { IsString, MinLength } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class ResetPasswordDto {
    /** Access token from password reset email */
    @AcceptSnakeCase()
    @IsString()
    accessToken: string;

    /** New password (min length = 8) */
    @AcceptSnakeCase()
    @IsString()
    @MinLength(8)
    newPassword: string;
}
