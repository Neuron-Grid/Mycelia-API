import { STATUS_CODES } from "node:http";
import {
    type ArgumentsHost,
    Catch,
    type ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status: number =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        let message: string | string[] = "Internal server error";
        let errorLabel: string = STATUS_CODES[status] ?? "Error";

        if (exception instanceof HttpException) {
            const res = exception.getResponse();
            if (typeof res === "string") {
                message = res;
            } else if (res && typeof res === "object") {
                const r = res as { message?: unknown; error?: unknown };
                // message can be string | string[]
                if (Array.isArray(r.message)) {
                    message = r.message.filter(
                        (v): v is string => typeof v === "string",
                    );
                } else if (typeof r.message === "string") {
                    message = r.message;
                } else if (
                    typeof (exception as unknown as { message?: unknown })
                        ?.message === "string"
                ) {
                    message = (exception as unknown as { message: string })
                        .message;
                }

                if (typeof r.error === "string" && r.error.length > 0) {
                    errorLabel = r.error;
                } else {
                    errorLabel = STATUS_CODES[status] ?? exception.name;
                }
            } else {
                // Fallbacks
                const exMsg = (exception as unknown as { message?: unknown })
                    ?.message;
                if (typeof exMsg === "string" && exMsg.length > 0) {
                    message = exMsg;
                }
                errorLabel = STATUS_CODES[status] ?? exception.name;
            }
        } else if (
            exception &&
            typeof (exception as { message?: unknown }).message === "string"
        ) {
            message = (exception as { message: string }).message;
            errorLabel = STATUS_CODES[status] ?? "Error";
        }

        const payload = {
            statusCode: status,
            message,
            error: errorLabel,
            path: request.url,
            timestamp: new Date().toISOString(),
        };

        this.logger.error(
            `HTTP Status: ${status} Error: ${errorLabel} Message: ${JSON.stringify(message)}`,
            exception instanceof Error ? exception.stack : "",
        );

        response.status(status).json(payload);
    }
}
