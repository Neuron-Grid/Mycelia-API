import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
} from "class-validator";

/**
 * WebAuthn 登録開始リクエスト DTO
 *
 * クライアント側で navigator.credentials.create() を呼び出す前に
 * displayName を（任意で）送信してデバイス識別名とする。
 */
export class StartWebAuthnRegistrationDto {
    @ApiPropertyOptional({
        example: "MacBook Pro Touch ID",
        description: "登録するパスキーを識別する任意の表示名",
    })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    displayName?: string;
}

/**
 * WebAuthn 登録完了リクエスト DTO
 *
 * navigator.credentials.create() の戻り値 (PublicKeyCredential) を
 * JSON へシリアライズしたものをそのまま送信する想定。
 */
export class FinishWebAuthnRegistrationDto {
    @ApiProperty({
        description: "navigator.credentials.create() で得た credential 全体",
        type: "object",
        additionalProperties: true,
        example: {
            id: "credentialId",
            rawId: "BASE64URL",
            type: "public-key",
            response: {
                attestationObject: "BASE64URL",
                clientDataJSON: "BASE64URL",
            },
        },
    })
    @IsNotEmpty()
    @IsObject()
    attestationResponse!: Record<string, unknown>;
}

/**
 * WebAuthn 認証 (サインイン) 検証リクエスト DTO
 *
 * navigator.credentials.get() の戻り値 (PublicKeyCredential) を
 * JSON で送信する。
 */
export class VerifyWebAuthnAssertionDto {
    @ApiProperty({
        example: "webauthn_factor_id",
        description: "Supabase が払い出した WebAuthn ファクター ID",
    })
    @IsString()
    @IsNotEmpty()
    factorId!: string;

    @ApiProperty({
        description: "navigator.credentials.get() で得た credential 全体",
        type: "object",
        additionalProperties: true,
        example: {
            id: "credentialId",
            rawId: "BASE64URL",
            type: "public-key",
            response: {
                authenticatorData: "BASE64URL",
                clientDataJSON: "BASE64URL",
                signature: "BASE64URL",
                userHandle: "BASE64URL",
            },
        },
    })
    @IsNotEmpty()
    @IsObject()
    assertionResponse!: Record<string, unknown>;
}
