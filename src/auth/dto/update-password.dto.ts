import { IsString, MinLength } from "class-validator";

export class UpdatePasswordDto {
    /** Current password */
    @IsString()
    oldPassword: string;

    /** New password (min length = 8) */
    @IsString()
    @MinLength(8)
    newPassword: string;
}
