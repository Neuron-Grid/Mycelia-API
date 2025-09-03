import { IsEmail, MaxLength } from "class-validator";

export class UpdateEmailDto {
    /** New email address */
    @IsEmail()
    @MaxLength(100)
    newEmail: string;
}
