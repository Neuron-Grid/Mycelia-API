import { IsNotEmpty, IsString } from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

/**
 * TOTP 要素を無効化するリクエスト DTO
 */
export class DisableTotpDto {
    /** 無効化したい TOTP ファクター ID */
    @AcceptSnakeCase()
    @IsString()
    @IsNotEmpty()
    factorId!: string;
}
