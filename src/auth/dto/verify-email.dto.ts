import { IsEmail, IsString } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class VerifyEmailDto {
    /** Email address to verify */
    @AcceptSnakeCase()
    @IsEmail()
    email: string;

    /** Email verification token */
    @AcceptSnakeCase()
    @IsString()
    token: string;
}
