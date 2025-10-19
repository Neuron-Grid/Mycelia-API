import { IsNotEmpty, IsString } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class VerifyTotpDto {
    /** TOTP factor ID */
    @AcceptSnakeCase()
    @IsString()
    @IsNotEmpty()
    factorId: string;

    /** TOTP verification code */
    @AcceptSnakeCase()
    @IsString()
    @IsNotEmpty()
    code: string;
}
