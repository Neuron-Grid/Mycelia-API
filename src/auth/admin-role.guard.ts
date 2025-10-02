import {
    type CanActivate,
    type ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import type { JwtAuthClaims } from "@/types/auth-claims";

@Injectable()
export class AdminRoleGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context
            .switchToHttp()
            .getRequest<Request & { authClaims?: JwtAuthClaims }>();

        const claims = req.authClaims;
        if (!claims) {
            throw new UnauthorizedException("Missing JWT claims");
        }

        const role = this.resolveRole(claims);
        if (!role || role.toLowerCase() !== "admin") {
            throw new ForbiddenException("Admin role required");
        }

        return true;
    }

    private resolveRole(claims: JwtAuthClaims): string | null {
        const directRole = this.pickString(
            (claims as Record<string, unknown>).role,
        );
        if (directRole) return directRole;

        const appMeta = claims.app_metadata as
            | Record<string, unknown>
            | undefined;
        if (appMeta) {
            const metaRecord = appMeta as Record<string, unknown>;
            const metaRole = this.pickString(metaRecord.role);
            if (metaRole) return metaRole;

            const metaRoles = metaRecord.roles;
            if (Array.isArray(metaRoles)) {
                const fromArray = metaRoles.find((value): value is string =>
                    this.isNonEmptyString(value),
                );
                if (fromArray) return fromArray;
            }
        }

        const roles = (claims as Record<string, unknown>).roles;
        if (Array.isArray(roles)) {
            const fromRoles = roles.find((value): value is string =>
                this.isNonEmptyString(value),
            );
            if (fromRoles) return fromRoles;
        }

        return null;
    }

    private pickString(value: unknown): string | null {
        return this.isNonEmptyString(value) ? value : null;
    }

    private isNonEmptyString(value: unknown): value is string {
        return typeof value === "string" && value.trim().length > 0;
    }
}
