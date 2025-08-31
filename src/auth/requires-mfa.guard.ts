import {
    type CanActivate,
    type ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import type { JwtAuthClaims } from "@/types/auth-claims";

/**
 * MFA 必須ルート用 Guard。
 * - JWT の amr に `totp` または `webauthn` が含まれる
 * - かつ acr (aal) が `aal2` 以上
 * を満たさない場合は 403 を返す。
 */
@Injectable()
export class RequiresMfaGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context
            .switchToHttp()
            .getRequest<Request & { authClaims?: JwtAuthClaims }>();

        if (!req.authClaims) {
            throw new UnauthorizedException("Missing JWT claims");
        }

        const { amr, acr, aal } = req.authClaims;

        const hasMfaAmr = amr?.some((m) => m === "totp" || m === "webauthn");
        const isAal2 =
            typeof acr === "string"
                ? acr === "aal2"
                : typeof aal === "string"
                  ? aal === "aal2"
                  : aal === 2;

        if (!hasMfaAmr || !isAal2) {
            throw new ForbiddenException(
                "Multi-factor authentication required",
            );
        }

        return true;
    }
}
