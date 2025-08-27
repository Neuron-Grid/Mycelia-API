import { Response } from "express";

/**
 * Supabase JWT を Cookie としてクライアントへ送信するユーティリティ
 *  - __Host-access_token   : 15 分  (path "/")
 *  - __Secure-refresh_token: 30 日  (path "/api/v1/auth/refresh")
 */
export function setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
): void {
    if (!accessToken || !refreshToken) return;

    // アクセストークン (Host cookie, path = "/")
    res.cookie("__Host-access_token", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // リフレッシュトークン (Secure cookie, path 固定)
    res.cookie("__Secure-refresh_token", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/api/v1/auth/refresh",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
}
