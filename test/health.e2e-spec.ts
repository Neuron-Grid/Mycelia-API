import { jest } from "@jest/globals";
import "@/setup/nestia";
import {
    type ExecutionContext,
    ForbiddenException,
    INestApplication,
    UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import type Redis from "ioredis";
import { AdminRoleGuard } from "@/auth/admin-role.guard";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { HealthController } from "@/health/health.controller";
import { HealthModule } from "@/health/health.module";
import { RedisService } from "@/shared/redis/redis.service";
import { SupabaseAdminService } from "@/shared/supabase-admin.service";
import { SupabaseRequestService } from "@/supabase-request.service";

type AuthMode = "allow" | "unauthorized";

const guardState: {
    authMode: AuthMode;
    mfaSatisfied: boolean;
    adminAllowed: boolean;
} = {
    authMode: "allow",
    mfaSatisfied: true,
    adminAllowed: true,
};

jest.mock("@nestjs/throttler", () => ({
    ThrottlerGuard: class {
        canActivate(): boolean {
            return true;
        }
    },
    Throttle: () => () => undefined,
}));

jest.mock("@/auth/supabase-auth.guard", () => ({
    SupabaseAuthGuard: class {
        canActivate(context: ExecutionContext): boolean {
            if (guardState.authMode === "unauthorized") {
                throw new UnauthorizedException();
            }
            const req = context.switchToHttp().getRequest();
            req.user = { id: "user-1" };
            req.authClaims = {
                role: guardState.adminAllowed ? "admin" : "user",
            };
            return true;
        }
    },
}));

jest.mock("@/auth/requires-mfa.guard", () => ({
    RequiresMfaGuard: class {
        canActivate(): boolean {
            if (!guardState.mfaSatisfied) {
                throw new ForbiddenException(
                    "Multi-factor authentication required",
                );
            }
            return true;
        }
    },
}));

jest.mock("@/auth/admin-role.guard", () => ({
    AdminRoleGuard: class {
        canActivate(): boolean {
            if (!guardState.adminAllowed) {
                throw new ForbiddenException("Admin role required");
            }
            return true;
        }
    },
}));

const createSupabaseStub = () => {
    const limit = jest.fn().mockResolvedValue({ data: [], error: null });
    const select = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ select });
    return { from };
};

async function createApp(): Promise<INestApplication> {
    const supabaseClient = createSupabaseStub();
    const redisClient = {
        status: "ready" as Redis["status"],
        ping: jest.fn().mockResolvedValue("PONG"),
        once: jest.fn().mockReturnThis(),
        removeListener: jest.fn().mockReturnThis(),
    } satisfies Pick<Redis, "status" | "ping" | "once" | "removeListener">;

    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [HealthModule],
    })
        .overrideProvider(ConfigService)
        .useValue({
            get: (key: string) => {
                switch (key) {
                    case "REDIS_URL":
                        return "redis://localhost:6379";
                    case "SUPABASE_URL":
                        return "https://example.supabase.co";
                    case "SUPABASE_SERVICE_ROLE_KEY":
                        return "service_role";
                    case "SUPABASE_ANON_KEY":
                        return "anon_key";
                    default:
                        return undefined;
                }
            },
        })
        .overrideProvider(SupabaseRequestService)
        .useValue({ getClient: () => supabaseClient })
        .overrideProvider(SupabaseAdminService)
        .useValue({ getClient: () => ({}) })
        .overrideProvider(RedisService)
        .useValue({ getHealthClient: () => redisClient })
        .compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    return app;
}

const createExecutionContext = () => {
    const request: Record<string, unknown> = {};
    const context: ExecutionContext = {
        switchToHttp: () => ({
            getRequest: () => request,
        }),
    } as ExecutionContext;
    return { context, request };
};

describe("/api/v1/health guards", () => {
    let app: INestApplication;

    beforeAll(async () => {
        app = await createApp();
    });

    afterAll(async () => {
        await app?.close();
    });

    afterEach(() => {
        guardState.authMode = "allow";
        guardState.mfaSatisfied = true;
        guardState.adminAllowed = true;
    });

    it("throws UnauthorizedException when SupabaseAuthGuard rejects", () => {
        guardState.authMode = "unauthorized";
        const guard = new SupabaseAuthGuard();
        const { context } = createExecutionContext();

        expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it("throws ForbiddenException when AdminRoleGuard rejects", () => {
        guardState.adminAllowed = false;
        const guard = new AdminRoleGuard();
        const { context } = createExecutionContext();

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("returns sanitized payload without BullMQ data", async () => {
        const guard = new SupabaseAuthGuard();
        const { context, request } = createExecutionContext();
        guard.canActivate(context);

        const controller = app.get(HealthController);
        const response = await controller.checkHealth();

        expect(response).toMatchSnapshot();
        expect(request.authClaims).toEqual({ role: "admin" });
    });
});
