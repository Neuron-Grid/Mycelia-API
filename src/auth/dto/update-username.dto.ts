import { IsString, MaxLength } from "class-validator";

export class UpdateUsernameDto {
    /** New username */
    @IsString()
    @MaxLength(100)
    newUsername: string;
}
