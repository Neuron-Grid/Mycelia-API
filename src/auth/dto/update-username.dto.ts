import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class UpdateUsernameDto {
    @ApiProperty({ example: "newUsername", description: "New username" })
    @IsString()
    @MaxLength(100)
    newUsername: string;
}
