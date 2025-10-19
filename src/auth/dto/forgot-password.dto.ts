import { IsEmail } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class ForgotPasswordDto {
    /** Email address for password reset */
    @AcceptSnakeCase()
    @IsEmail()
    email: string;
}
