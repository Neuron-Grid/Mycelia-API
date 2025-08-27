import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

/**
 * TOTP 要素を無効化するリクエスト DTO
 */
export class DisableTotpDto {
    @ApiProperty({
        example: "totp_factor_id",
        description: "無効化したい TOTP ファクター ID",
    })
    @IsString()
    @IsNotEmpty()
    factorId!: string;
}
