import { IsEmail, IsString, MinLength } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class SignInDto {
    /** User email address */
    @AcceptSnakeCase()
    @IsEmail()
    email: string;

    /** User password (min length = 8) */
    @AcceptSnakeCase()
    @IsString()
    @MinLength(8)
    password: string;
}
