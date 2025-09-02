// @file 認証・ユーザー管理APIのコントローラ

import { TypedRoute } from "@nestia/core";
import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Req,
    Res,
    UseGuards,
} from "@nestjs/common";
// @see https://docs.nestjs.com/openapi/introduction
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
// @see https://supabase.com/docs/reference/javascript/auth-api
import type { User } from "@supabase/supabase-js";
import type { Request, Response } from "express";
import { setAuthCookies } from "src/common/utils/cookie";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import { AuthService } from "./auth.service";
import type { DisableTotpDto } from "./dto/disable-totp.dto";
import type { EnrollTotpDto } from "./dto/enroll-totp.dto";
import type { ForgotPasswordDto } from "./dto/forgot-password.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import type { SignInDto } from "./dto/sign-in.dto";
import type { SignUpDto } from "./dto/sign-up.dto";
import type { UpdateEmailDto } from "./dto/update-email.dto";
import type { UpdatePasswordDto } from "./dto/update-password.dto";
import type { UpdateUsernameDto } from "./dto/update-username.dto";
import type { VerifyEmailDto } from "./dto/verify-email.dto";
import type { VerifyTotpDto } from "./dto/verify-totp.dto";
import type {
    FinishWebAuthnRegistrationDto,
    StartWebAuthnRegistrationDto,
    VerifyWebAuthnAssertionDto,
} from "./dto/webauthn.dto";
import { RequiresMfaGuard } from "./requires-mfa.guard";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { SupabaseUser } from "./supabase-user.decorator";
import { UserId } from "./user-id.decorator";
import { WebAuthnService } from "./webauthn.service";
@ApiTags("Authentication")
@Controller({
    path: "auth",
    version: "1",
})
// @public
// @since 1.0.0
@UseGuards(ThrottlerGuard)
export class AuthController {
    // @param {AuthService} authService - 認証サービス
    // @since 1.0.0
    // @public
    constructor(
        private readonly authService: AuthService,
        private readonly webauthn: WebAuthnService,
    ) {}

    // @async
    // @public
    // @since 1.0.0
    // @param {SignUpDto} signUpDto - ユーザー登録情報
    // @returns {Promise<unknown>} - 登録結果のレスポンス
    // @throws {HttpException} - 登録失敗時
    // @example
    // await authController.signUp({ email, password, username })
    // @see AuthService.signUp
    @TypedRoute.Post("signup")
    async signUp(@Body() signUpDto: SignUpDto) {
        const { email, password, username } = signUpDto;
        const result = await this.authService.signUp(email, password, username);
        return buildResponse("Signup successful", result);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {SignInDto} signInDto - ログイン情報
    // @returns {Promise<unknown>} - ログイン結果のレスポンス
    // @throws {HttpException} - 認証失敗時
    // @example
    // await authController.signIn({ email, password })
    // @see AuthService.signIn
    @TypedRoute.Post("login")
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: 60 } })
    @ApiResponse({
        status: 201,
        description:
            "Set-Cookie: __Host-access_token, __Secure-refresh_token を返します",
        headers: {
            "Set-Cookie": {
                description:
                    "Sets __Host-access_token (Path=/) and __Secure-refresh_token (Path=/api/v1/auth/refresh)",
                schema: { type: "string" },
            },
        },
    })
    async signIn(
        @Body() signInDto: SignInDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { email, password } = signInDto;
        const result = await this.authService.signIn(email, password);
        const authRes = result as {
            user?: User | null;
            session?: { access_token?: string; refresh_token?: string } | null;
        };

        // Supabase Sessionからアクセストークン/リフレッシュトークンを取得
        const accessToken = authRes.session?.access_token ?? "";
        const refreshToken = authRes.session?.refresh_token ?? "";

        if (!accessToken || !refreshToken) {
            // ありえないが保険
            return buildResponse("Login successful (no session)", {
                user: authRes.user ?? null,
            });
        }

        // 認証系レスポンスはキャッシュ禁止
        res.setHeader("Cache-Control", "no-store, private");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        // Cookie属性
        const accessCookieOptions = {
            httpOnly: true as const,
            secure: true as const,
            sameSite: "lax" as const,
            path: "/",
            maxAge: 15 * 60 * 1000, // 15 min
        };
        const refreshCookieOptions = {
            httpOnly: true as const,
            secure: true as const,
            sameSite: "lax" as const,
            // APIへのプレフィックスに合わせる
            path: "/api/v1/auth/refresh",
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        };

        // Set-Cookie を設定
        // 強化: Cookie名プリフィックスを利用
        // - アクセス: __Host- 前提 (Secure/Path=/、Domain未指定)
        // - リフレッシュ: __Secure- 前提（Path制限あり）
        res.cookie("__Host-access_token", accessToken, accessCookieOptions);
        res.cookie(
            "__Secure-refresh_token",
            refreshToken,
            refreshCookieOptions,
        );

        // トークンはレスポンスボディに含めない
        return buildResponse("Login successful", {
            user: authRes.user ?? null,
        });
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {ForgotPasswordDto} dto - パスワードリセットリクエスト情報
    // @returns {Promise<unknown>} - リセットメール送信結果のレスポンス
    // @throws {HttpException} - 送信失敗時
    // @example
    // await authController.forgotPassword({ email })
    // @see AuthService.forgotPassword
    @TypedRoute.Post("forgot-password")
    @HttpCode(HttpStatus.OK)
    async forgotPassword(
        @Body() dto: ForgotPasswordDto,
    ): Promise<SuccessResponse<unknown>> {
        const { email } = dto;
        const result = await this.authService.forgotPassword(email);
        return buildResponse("Password reset email sent", result);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {ResetPasswordDto} dto - リセット情報
    // @returns {Promise<unknown>} - リセット処理結果のレスポンス
    // @throws {HttpException} - リセット失敗時
    // @example
    // await authController.resetPassword({ accessToken, newPassword })
    // @see AuthService.resetPassword
    @TypedRoute.Post("reset-password")
    @HttpCode(HttpStatus.OK)
    async resetPassword(
        @Body() dto: ResetPasswordDto,
    ): Promise<SuccessResponse<unknown>> {
        const { accessToken, newPassword } = dto;
        const result = await this.authService.resetPassword(
            accessToken,
            newPassword,
        );
        return buildResponse("Password has been reset", result);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {VerifyEmailDto} dto - メール認証情報
    // @returns {Promise<unknown>} - 認証処理結果のレスポンス
    // @throws {HttpException} - 認証失敗時
    // @example
    // await authController.verifyEmail({ email, token })
    // @see AuthService.verifyEmail
    @TypedRoute.Post("verify-email")
    @HttpCode(HttpStatus.OK)
    async verifyEmail(
        @Body() dto: VerifyEmailDto,
    ): Promise<SuccessResponse<unknown>> {
        const { email, token } = dto;
        const result = await this.authService.verifyEmail(email, token);
        return buildResponse("Email verified successfully", result);
    }

    // @async
    // @public
    // @since 1.0.0
    // @returns {Promise<unknown>} - ログアウト処理結果のレスポンス
    // @throws {HttpException} - ログアウト失敗時
    // @example
    // await authController.signOut()
    // @see AuthService.signOut
    @TypedRoute.Post("logout")
    @HttpCode(HttpStatus.OK)
    @ApiResponse({
        status: 201,
        description:
            "Set-Cookie: __Host-access_token, __Secure-refresh_token を無効化して返します",
        headers: {
            "Set-Cookie": {
                description:
                    "Clears __Host-access_token and __Secure-refresh_token cookies",
                schema: { type: "string" },
            },
        },
    })
    async signOut(
        @Res({ passthrough: true }) res: Response,
    ): Promise<SuccessResponse<unknown>> {
        // 認証が無くてもCookie破棄は必ず実施可能に
        // 可能ならSupabase側セッション失効も試行
        let result: unknown = { signedOut: false };
        try {
            result = await this.authService.signOut();
        } catch {
            // アクセストークン期限切れ等は無視してCookie破棄を継続
        }

        // 認証系レスポンスはキャッシュ禁止
        res.setHeader("Cache-Control", "no-store, private");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        // Cookie無効化（Pathが一致しないと削除されない点に注意）
        res.cookie("__Host-access_token", "", {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 0,
        });
        res.cookie("__Secure-refresh_token", "", {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/api/v1/auth/refresh",
            maxAge: 0,
        });

        return buildResponse("Logout successful", result);
    }

    // リフレッシュ
    // refresh_token Cookie を検証し、新しい access_token Cookie を返す
    @TypedRoute.Post("refresh")
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: 60 } })
    @ApiResponse({
        status: 201,
        description:
            "Set-Cookie: __Host-access_token（必須）と必要に応じて__Secure-refresh_tokenを返します",
        headers: {
            "Set-Cookie": {
                description:
                    "Sets new __Host-access_token and optionally updates __Secure-refresh_token",
                schema: { type: "string" },
            },
        },
    })
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<SuccessResponse<{ refreshed: boolean }>> {
        const cookies = (req as unknown as { cookies?: Record<string, string> })
            .cookies;
        const refreshToken =
            cookies?.["__Secure-refresh_token"] ?? cookies?.refresh_token;
        if (!refreshToken) {
            res.setHeader("WWW-Authenticate", 'Bearer error="invalid_token"');
            res.setHeader("Cache-Control", "no-store, private");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
            res.status(401);
            return buildResponse("No refresh token", { refreshed: false });
        }

        // リポジトリ経由でリフレッシュ
        let access_token = "";
        let refresh_token: string | undefined;
        try {
            const resTokens =
                await this.authService.refreshAccessToken(refreshToken);
            access_token = resTokens.access_token;
            refresh_token = resTokens.refresh_token;
        } catch (e) {
            // 401系は明示的にチャレンジヘッダを返す
            res.setHeader("WWW-Authenticate", 'Bearer error="invalid_token"');
            throw e;
        }

        // 認証系レスポンスはキャッシュ禁止
        res.setHeader("Cache-Control", "no-store, private");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        // Cookie属性
        const accessCookieOptions = {
            httpOnly: true as const,
            secure: true as const,
            sameSite: "lax" as const,
            path: "/",
            maxAge: 15 * 60 * 1000,
        };
        const refreshCookieOptions = {
            httpOnly: true as const,
            secure: true as const,
            sameSite: "lax" as const,
            path: "/api/v1/auth/refresh",
            maxAge: 30 * 24 * 60 * 60 * 1000,
        };

        // 新しいアクセストークンを返す（必要に応じてリフレッシュも更新）
        res.cookie("__Host-access_token", access_token, accessCookieOptions);
        if (refresh_token) {
            res.cookie(
                "__Secure-refresh_token",
                refresh_token,
                refreshCookieOptions,
            );
        }

        return buildResponse("Token refreshed", { refreshed: true });
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - 認証済みユーザー
    // @returns {Promise<unknown>} - アカウント削除処理結果のレスポンス
    // @throws {HttpException} - 削除失敗時
    // @example
    // await authController.deleteAccount(user)
    // @see AuthService.deleteAccount
    @TypedRoute.Delete("delete")
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard, RequiresMfaGuard)
    async deleteAccount(
        @UserId() userId: string,
    ): Promise<SuccessResponse<unknown>> {
        const result = await this.authService.deleteAccount(userId);
        return buildResponse("Account deleted", result);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - 認証済みユーザー
    // @param {UpdateEmailDto} dto - 新しいメールアドレス情報
    // @returns {Promise<unknown>} - メールアドレス更新処理結果のレスポンス
    // @throws {HttpException} - 更新失敗時
    // @example
    // await authController.updateEmail(user, { newEmail: 'new@example.com' })
    // @see AuthService.updateEmail
    @TypedRoute.Patch("update-email")
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard, RequiresMfaGuard)
    async updateEmail(
        @SupabaseUser() user: User,
        @Body() dto: UpdateEmailDto,
    ): Promise<SuccessResponse<unknown>> {
        const result = await this.authService.updateEmail(user, dto.newEmail);
        return buildResponse("Email updated successfully", result);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - 認証済みユーザー
    // @param {UpdateUsernameDto} dto - 新しいユーザー名情報
    // @returns {Promise<unknown>} - ユーザー名更新処理結果のレスポンス
    // @throws {HttpException} - 更新失敗時
    // @example
    // await authController.updateUsername(user, { newUsername: 'newname' })
    // @see AuthService.updateUsername
    @TypedRoute.Patch("update-username")
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard, RequiresMfaGuard)
    async updateUsername(
        @SupabaseUser() user: User,
        @Body() dto: UpdateUsernameDto,
    ): Promise<SuccessResponse<unknown>> {
        const result = await this.authService.updateUsername(
            user,
            dto.newUsername,
        );
        return buildResponse("Username updated successfully", result);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - 認証済みユーザー
    // @param {UpdatePasswordDto} dto - パスワード更新情報
    // @returns {Promise<unknown>} - パスワード更新処理結果のレスポンス
    // @throws {HttpException} - 更新失敗時
    // @example
    // await authController.updatePassword(user, { oldPassword: 'old', newPassword: 'new' })
    // @see AuthService.updatePassword
    @TypedRoute.Patch("update-password")
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard, RequiresMfaGuard)
    async updatePassword(
        @SupabaseUser() _user: User,
        @Body() dto: UpdatePasswordDto,
    ): Promise<SuccessResponse<unknown>> {
        const { oldPassword, newPassword } = dto;
        const result = await this.authService.updatePassword(
            _user,
            oldPassword,
            newPassword,
        );
        return buildResponse("Password updated successfully", result);
    }

    // @public
    // @since 1.0.0
    // @param {User} user - 認証済みユーザー
    // @returns {{ message: string, data: User }} - ユーザープロフィールのレスポンス
    // @example
    // authController.getProfile(user)
    @TypedRoute.Get("profile")
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard, RequiresMfaGuard)
    getProfile(@SupabaseUser() user: User): SuccessResponse<User> {
        return buildResponse("User profile fetched successfully", user);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {VerifyTotpDto} dto - TOTP認証情報
    // @returns {Promise<unknown>} - TOTP認証処理結果のレスポンス
    // @throws {HttpException} - 認証失敗時
    // @example
    // await authController.verifyTotp({ factorId, code })
    // @see AuthService.verifyTotp
    @TypedRoute.Post("verify-totp")
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: { limit: 5, ttl: 60 },
    })
    async verifyTotp(
        @Body() dto: VerifyTotpDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<SuccessResponse<unknown>> {
        const { factorId, code } = dto;
        const result = await this.authService.verifyTotp(factorId, code);

        // セッションが含まれていれば Cookie を再設定
        const { session } = result as {
            session?: { access_token?: string; refresh_token?: string };
        };
        if (session?.access_token && session?.refresh_token) {
            setAuthCookies(res, session.access_token, session.refresh_token);
        }

        return buildResponse("TOTP verified successfully", result);
    }

    // 仕様に合わせたTOTP verify新ルート（既存と同実装）
    @TypedRoute.Post("mfa/totp/verify")
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60 } })
    async verifyTotpNew(
        @Body() dto: VerifyTotpDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<SuccessResponse<unknown>> {
        const { factorId, code } = dto;
        const result = await this.authService.verifyTotp(factorId, code);
        const { session } = result as {
            session?: { access_token?: string; refresh_token?: string };
        };
        if (session?.access_token && session?.refresh_token) {
            setAuthCookies(res, session.access_token, session.refresh_token);
        }
        return buildResponse("TOTP verified successfully", result);
    }

    /* ------------------------------------------------------------------
     * WebAuthn (Passkey) endpoints
     * ------------------------------------------------------------------ */
    // 登録開始: navigator.credentials.create() 前段で呼び出し
    @TypedRoute.Post("mfa/webauthn/register")
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard, ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60 } })
    async startWebAuthnRegistration(
        @Body() dto: StartWebAuthnRegistrationDto,
    ): Promise<SuccessResponse<unknown>> {
        const data = await this.webauthn.startRegistration(dto?.displayName);
        return buildResponse("WebAuthn registration started", data);
    }

    // 登録完了: attestationResponse を検証
    @TypedRoute.Post("mfa/webauthn/callback")
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard, ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60 } })
    async finishWebAuthnRegistration(
        @Body() dto: FinishWebAuthnRegistrationDto,
    ): Promise<SuccessResponse<unknown>> {
        const data = await this.webauthn.finishRegistration(
            dto.attestationResponse,
        );
        return buildResponse("WebAuthn registration finished", data);
    }

    // 認証検証: navigator.credentials.get() 後に呼び出す
    @TypedRoute.Post("mfa/webauthn/verify")
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60 } })
    async verifyWebAuthnAssertion(
        @Body() dto: VerifyWebAuthnAssertionDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<SuccessResponse<unknown>> {
        const data = await this.webauthn.verifyAssertion(dto.assertionResponse);
        // セッションが含まれていれば Cookie 設定
        const { session } = data as {
            session?: { access_token?: string; refresh_token?: string };
        };
        if (session?.access_token && session?.refresh_token) {
            setAuthCookies(res, session.access_token, session.refresh_token);
        }
        return buildResponse("WebAuthn assertion verified", data);
    }

    // TOTP enroll（QR/otpauth URI を返す）
    @TypedRoute.Patch("mfa/totp/enroll")
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard, RequiresMfaGuard, ThrottlerGuard)
    @Throttle({
        default: { limit: 5, ttl: 60 },
    })
    async enrollTotp(
        @Body() dto: EnrollTotpDto,
    ): Promise<SuccessResponse<{ factorId: string; otpauthUri: string }>> {
        const result = await this.authService.enrollTotp(dto?.displayName);
        return buildResponse("TOTP enrollment created", {
            factorId: result.id,
            otpauthUri: result.otpauthUri,
        });
    }

    // 既存 TOTP factor を無効化
    @TypedRoute.Patch("mfa/totp/disable")
    @ApiBearerAuth()
    @UseGuards(SupabaseAuthGuard, RequiresMfaGuard, ThrottlerGuard)
    @Throttle({
        default: { limit: 5, ttl: 60 },
    })
    async disableTotp(
        @Body() dto: DisableTotpDto,
    ): Promise<SuccessResponse<unknown>> {
        const result = await this.authService.disableTotp(dto.factorId);
        return buildResponse("TOTP factor disabled", result);
    }
}
