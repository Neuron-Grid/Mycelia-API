import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";
const MAX_REQUEST_ID_LENGTH = 128;

const sanitizeHeaderValue = (value: string): string =>
    value.replace(/[\r\n]/g, "").replace(/[^\x20-\x7E]/g, "");

const resolveRequestId = (req: Request): string => {
    const headerValue = req.headers[REQUEST_ID_HEADER];
    const candidate = Array.isArray(headerValue)
        ? headerValue[0]
        : headerValue;
    if (typeof candidate === "string") {
        const trimmed = sanitizeHeaderValue(candidate.trim());
        if (trimmed.length > 0 && trimmed.length <= MAX_REQUEST_ID_LENGTH) {
            return trimmed;
        }
    }
    return randomUUID();
};

type RequestWithContext = Request & { requestId?: string; user?: { id?: string } };

export function createRequestLoggingMiddleware() {
    const logger = new Logger("HttpAccess");
    return function requestLogging(
        req: RequestWithContext,
        res: Response,
        next: NextFunction,
    ) {
        const requestId = resolveRequestId(req);
        req.requestId = requestId;
        res.setHeader("X-Request-Id", requestId);

        const startAt = process.hrtime.bigint();
        res.on("finish", () => {
            const durationMs =
                Number(process.hrtime.bigint() - startAt) / 1_000_000;
            const payload = {
                type: "access",
                method: req.method,
                path: req.originalUrl ?? req.url,
                status: res.statusCode,
                durationMs: Math.round(durationMs * 10) / 10,
                requestId,
                userId: req.user?.id ?? null,
                ip: req.ip ?? null,
            };

            const message = JSON.stringify(payload);
            if (res.statusCode >= 500) {
                logger.error(message);
                return;
            }
            if (res.statusCode >= 400) {
                logger.warn(message);
                return;
            }
            logger.log(message);
        });

        next();
    };
}
