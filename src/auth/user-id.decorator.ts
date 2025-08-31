import {
    createParamDecorator,
    type ExecutionContext,
    InternalServerErrorException,
} from "@nestjs/common";

export const UserId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;

        if (typeof user?.id !== "string") {
            // This should ideally be caught by the AuthGuard, but as a fallback.
            throw new InternalServerErrorException(
                "User ID not found or invalid in request.",
            );
        }

        return user.id;
    },
);
