import { IsNotEmpty, IsString } from "class-validator";

export class VerifyTotpDto {
    /** TOTP factor ID */
    @IsString()
    @IsNotEmpty()
    factorId: string;

    /** TOTP verification code */
    @IsString()
    @IsNotEmpty()
    code: string;
}
