import { IsString, MaxLength } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class UpdateUsernameDto {
    /** New username */
    @AcceptSnakeCase()
    @IsString()
    @MaxLength(100)
    newUsername: string;
}
