import crypto from "node:crypto";
import { HttpException, HttpStatus } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { NextFunction, Request, Response } from "express";

/**
 * Double submit cookie based CSRF protection.
 * - Issues `XSRF-TOKEN` cookie if missing.
 * - For non-idempotent methods, requires `X-CSRF-Token` header to match cookie.
 * - Skips a small set of auth endpoints to avoid bootstrap friction.
 */
export function createCsrfMiddleware(_cfg: ConfigService) {
    const skipPaths = new Set<string>([
        // Allow bootstrap on auth endpoints where client may not yet send header
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
    ]);

    return function csrfMiddleware(
        req: Request,
        res: Response,
        next: NextFunction,
    ) {
        const method = (req.method || "GET").toUpperCase();
        const isSafe =
            method === "GET" || method === "HEAD" || method === "OPTIONS";

        // Ensure token cookie exists
        const tokenCookie = (
            req as unknown as { cookies?: Record<string, string> }
        ).cookies?.["XSRF-TOKEN"];
        if (!tokenCookie) {
            const token = crypto.randomBytes(32).toString("base64url");
            res.cookie("XSRF-TOKEN", token, {
                httpOnly: false,
                secure: true,
                sameSite: "lax",
                path: "/",
                maxAge: 2 * 60 * 60 * 1000, // 2h
            });
        }

        if (isSafe || skipPaths.has(req.path)) return next();

        const header = req.get("X-CSRF-Token");
        const cookieToken = (
            req as unknown as { cookies?: Record<string, string> }
        ).cookies?.["XSRF-TOKEN"];

        if (!cookieToken || !header || cookieToken !== header) {
            // Let the global exception filter shape the error payload
            throw new HttpException(
                { message: "CSRF token mismatch" },
                HttpStatus.FORBIDDEN,
            );
        }

        return next();
    };
}

/**
 * Enforce HTTPS in production by checking req.secure or x-forwarded-proto.
 * Returns 403 when accessed via plain HTTP.
 */
export function createHttpsEnforceMiddleware(cfg: ConfigService) {
    const isProd =
        (cfg.get<string>("NODE_ENV") || "").toLowerCase() === "production";

    return function httpsOnly(
        req: Request,
        _res: Response,
        next: NextFunction,
    ) {
        if (!isProd) return next();
        const xfProto = (req.headers["x-forwarded-proto"] as string | undefined)
            ?.split(",")[0]
            ?.trim();
        const secure =
            (req as unknown as { secure?: boolean }).secure ||
            xfProto === "https";
        if (!secure) {
            // Unify error shape via global exception filter
            throw new HttpException(
                { message: "HTTPS required" },
                HttpStatus.FORBIDDEN,
            );
        }
        return next();
    };
}
