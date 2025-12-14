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
import type { AppEnv } from "@/config/app-env";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    constructor(private readonly appEnv: AppEnv) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const isProd = this.appEnv.deployStage === "production";
        const isDebug = !isProd;

        const isHttp = exception instanceof HttpException;
        const status: number = isHttp
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        const isServerError = status >= 500;

        const { extractedMessage, extractedErrorLabel } =
            this.extractExceptionDetails(exception, status);

        const clientMessage = isDebug
            ? extractedMessage
            : isServerError
              ? "Internal server error"
              : extractedMessage;

        const clientError =
            !isDebug && isServerError
                ? "Internal Server Error"
                : (extractedErrorLabel ?? STATUS_CODES[status] ?? "Error");

        const payload = {
            statusCode: status,
            message: clientMessage,
            error: clientError,
            path: request.url,
            timestamp: new Date().toISOString(),
        };

        this.logger.error(
            `HTTP Status: ${status} Error: ${clientError} Message: ${JSON.stringify(extractedMessage)}`,
            exception instanceof Error ? exception.stack : "",
        );

        response.status(status).json(payload);
    }

    private extractExceptionDetails(
        exception: unknown,
        status: number,
    ): {
        extractedMessage: string | string[];
        extractedErrorLabel: string | undefined;
    } {
        let message: string | string[] = "Internal server error";
        let errorLabel: string | undefined = STATUS_CODES[status] ?? "Error";

        if (exception instanceof HttpException) {
            const res = exception.getResponse();
            if (typeof res === "string") {
                message = res;
            } else if (res && typeof res === "object") {
                const r = res as { message?: unknown; error?: unknown };
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

        return {
            extractedMessage: message,
            extractedErrorLabel: errorLabel,
        };
    }
}
