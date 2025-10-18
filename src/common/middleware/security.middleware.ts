import crypto from "node:crypto";
import { HttpException, HttpStatus } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { NextFunction, Request, Response } from "express";

const resolveRequestScheme = (req: Request): "http" | "https" => {
    const toScheme = (
        value: string | null | undefined,
    ): "http" | "https" | null => {
        if (!value) return null;
        const normalized = value.trim().toLowerCase();
        if (normalized === "http" || normalized === "https") {
            return normalized;
        }
        return null;
    };

    const forwardedProtoRaw = req.headers["x-forwarded-proto"];
    const forwardedProto = Array.isArray(forwardedProtoRaw)
        ? forwardedProtoRaw[0]
        : forwardedProtoRaw?.split(",")[0];
    const viaForwardedProto = toScheme(forwardedProto);
    if (viaForwardedProto) return viaForwardedProto;

    const forwardedSchemeRaw = req.headers["x-forwarded-scheme"];
    const forwardedScheme = Array.isArray(forwardedSchemeRaw)
        ? forwardedSchemeRaw[0]
        : forwardedSchemeRaw;
    const viaForwardedScheme = toScheme(forwardedScheme);
    if (viaForwardedScheme) return viaForwardedScheme;

    const secure = (req as unknown as { secure?: boolean }).secure;
    if (secure === true) return "https";

    return req.protocol === "https" ? "https" : "http";
};

/**
 * Double submit cookie based CSRF protection.
 * - Issues `XSRF-TOKEN` cookie if missing.
 * - For non-idempotent methods, requires `X-CSRF-Token` header to match cookie.
 * - Skips a small set of auth endpoints to avoid bootstrap friction.
 */
export function createCsrfMiddleware(cfg: ConfigService) {
    const isProd =
        (cfg.get<string>("NODE_ENV") || "").toLowerCase() === "production";
    const skipPaths = new Set<string>([
        // Allow bootstrap on auth refresh/logout where rotating tokens may occur
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
    ]);
    const allowedOriginsRaw = cfg.get<string>("CORS_ORIGIN")?.trim() ?? "";
    const allowedOrigins = allowedOriginsRaw
        ? new Set(
              allowedOriginsRaw
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((origin) => origin.replace(/\/$/, "")),
          )
        : null;
    const loginPath = "/api/v1/auth/login";

    const normalizeOrigin = (value: string | undefined): string | null => {
        if (!value) return null;
        try {
            const parsed = new URL(value);
            return parsed.origin;
        } catch (_err) {
            return null;
        }
    };

    const isTrustedOrigin = (req: Request, source?: string | null): boolean => {
        if (!source) return true;
        const normalized = normalizeOrigin(source);
        if (!normalized) return false;
        if (allowedOrigins && allowedOrigins.size > 0) {
            return allowedOrigins.has(normalized);
        }
        const hostHeader = req.headers.host; // falls back to same-host check
        if (!hostHeader) return false;
        try {
            const hostOrigin = new URL(
                `${resolveRequestScheme(req)}://${hostHeader}`,
            ).origin;
            return hostOrigin === normalized;
        } catch (_err) {
            return false;
        }
    };

    const isJsonLoginRequest = (req: Request): boolean => {
        const header = req.headers["content-type"];
        if (!header) return false;
        const [actual] = header.split(";");
        return actual.trim().toLowerCase() === "application/json";
    };

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
                secure: isProd,
                sameSite: "lax",
                path: "/",
                maxAge: 2 * 60 * 60 * 1000, // 2h
            });
        }

        if (req.path === loginPath && method === "POST") {
            if (!isJsonLoginRequest(req)) {
                throw new HttpException(
                    { message: "Login requires application/json payload" },
                    HttpStatus.FORBIDDEN,
                );
            }
            const originHeader = req.headers.origin as string | undefined;
            const refererHeader = req.headers.referer as string | undefined;
            if (!isTrustedOrigin(req, originHeader ?? refererHeader ?? null)) {
                throw new HttpException(
                    { message: "Login origin mismatch" },
                    HttpStatus.FORBIDDEN,
                );
            }
            return next();
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
        const scheme = resolveRequestScheme(req);
        if (scheme !== "https") {
            // Unify error shape via global exception filter
            throw new HttpException(
                { message: "HTTPS required" },
                HttpStatus.FORBIDDEN,
            );
        }
        return next();
    };
}
