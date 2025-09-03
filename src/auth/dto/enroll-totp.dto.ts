import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * TOTP 登録リクエスト DTO
 *
 * 現状 Supabase Auth の TOTP enroll は追加パラメータを受け取らないため
 * 空 DTO でも動作するが、将来的に「デバイス名」等を受け取れるよう
 * displayName オプションを持たせている。
 */
export class EnrollTotpDto {
    /** この TOTP デバイスを識別する任意の表示名 */
    @IsOptional()
    @IsString()
    @MaxLength(64)
    displayName?: string;
}
