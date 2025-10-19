import { IsString, MinLength } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class UpdatePasswordDto {
    /** Current password */
    @AcceptSnakeCase()
    @IsString()
    oldPassword: string;

    /** New password (min length = 8) */
    @AcceptSnakeCase()
    @IsString()
    @MinLength(8)
    newPassword: string;
}
