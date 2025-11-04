import {
    ForbiddenException,
    Inject,
    Injectable,
    Scope,
    UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { Request } from "express";

type RequestWithUser = Request & {
    user?: { id?: unknown };
};

@Injectable({ scope: Scope.REQUEST })
export class RequestUserContextService {
    constructor(@Inject(REQUEST) private readonly request: RequestWithUser) {}

    getCurrentUserId(): string | undefined {
        const rawId = this.request?.user?.id;
        return typeof rawId === "string" ? rawId : undefined;
    }

    assertSameUser(userId: string): void {
        if (!userId) {
            throw new UnauthorizedException("User ID is required.");
        }

        const currentUserId = this.getCurrentUserId();

        if (!currentUserId) {
            throw new UnauthorizedException(
                "Authenticated user context is missing.",
            );
        }

        if (currentUserId !== userId) {
            throw new ForbiddenException(
                "User ID mismatch between request and payload.",
            );
        }
    }
}
