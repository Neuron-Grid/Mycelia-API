import { IsEmail, MaxLength } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class UpdateEmailDto {
    /** New email address */
    @AcceptSnakeCase()
    @IsEmail()
    @MaxLength(100)
    newEmail: string;
}
