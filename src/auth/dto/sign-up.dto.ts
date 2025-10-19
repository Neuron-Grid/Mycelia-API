import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class SignUpDto {
    /** User email address */
    @AcceptSnakeCase()
    @IsEmail()
    @MaxLength(100)
    email: string;

    /** User password (min length = 8) */
    @AcceptSnakeCase()
    @IsString()
    @MinLength(8)
    password: string;

    /** Display name for the user */
    @AcceptSnakeCase()
    @IsString()
    @MaxLength(100)
    username: string;
}
