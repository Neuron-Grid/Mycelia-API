import { IsNotEmpty, IsString } from "class-validator";

/**
 * TOTP 要素を無効化するリクエスト DTO
 */
export class DisableTotpDto {
    /** 無効化したい TOTP ファクター ID */
    @IsString()
    @IsNotEmpty()
    factorId!: string;
}
