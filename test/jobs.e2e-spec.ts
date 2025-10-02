import "@/setup/nestia";
import { jest } from "@jest/globals";

jest.mock("@nestia/core", () => ({
    TypedRoute: {
        Post: () => () => undefined,
        Get: () => () => undefined,
    },
    TypedBody: () => () => undefined,
    TypedQuery: () => () => undefined,
    TypedParam: () => () => undefined,
}));
jest.mock("@nestia/core/lib/decorators/NoTransformConfigurationError", () => ({
    NoTransformConfigurationError: { throws: false },
}));
jest.mock("@/auth/supabase-auth.guard", () => ({
    SupabaseAuthGuard: class {
        canActivate(): boolean {
            return true;
        }
    },
}));
jest.mock("@/shared/supabase-admin.service", () => ({
    SupabaseAdminService: class {
        getClient() {
            return {};
        }
    },
}));

import { getQueueToken } from "@nestjs/bullmq";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { RetryAllDto } from "@/jobs/dto/retry-all.dto";
import { JobsAdminController } from "@/jobs/jobs-admin.controller";

const createQueueStub = () => ({
    getFailed: jest.fn().mockResolvedValue([]),
});

async function createController(overrides?: {
    embeddingQueue?: ReturnType<typeof createQueueStub>;
}) {
    const embeddingQueue = overrides?.embeddingQueue ?? createQueueStub();
    const summaryQueue = createQueueStub();
    const scriptQueue = createQueueStub();
    const podcastQueue = createQueueStub();

    const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [JobsAdminController],
        providers: [
            {
                provide: getQueueToken("embeddingQueue"),
                useValue: embeddingQueue,
            },
            {
                provide: getQueueToken("summary-generate"),
                useValue: summaryQueue,
            },
            {
                provide: getQueueToken("script-generate"),
                useValue: scriptQueue,
            },
            { provide: getQueueToken("podcastQueue"), useValue: podcastQueue },
            {
                provide: ConfigService,
                useValue: {
                    get: (key: string) => {
                        switch (key) {
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
                },
            },
        ],
    }).compile();

    const controller = moduleFixture.get(JobsAdminController);
    return {
        controller,
        queues: {
            embeddingQueue,
            summaryQueue,
            scriptQueue,
            podcastQueue,
        },
    };
}

describe("JobsAdminController retryAll validation", () => {
    const pipe = new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    });

    it("rejects payloads with max greater than 200", async () => {
        await expect(() =>
            pipe.transform(
                { max: 1000 },
                { type: "body", metatype: RetryAllDto },
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
    });
});

describe("JobsAdminController retryAll execution", () => {
    it("clamps the limit to 200 when retrying", async () => {
        const embeddingQueue = createQueueStub();
        const jobRetry = jest.fn().mockResolvedValue(undefined);
        embeddingQueue.getFailed.mockImplementation(
            (_start: number, limit: number) => {
                expect(limit).toBe(200);
                return Promise.resolve([
                    {
                        data: { userId: "user-1" },
                        retry: jobRetry,
                    },
                ]);
            },
        );

        const { controller } = await createController({ embeddingQueue });

        const response = await controller.retryAll(
            { id: "user-1" } as never,
            { queue: "embeddingQueue" } as never,
            { max: 200 },
        );

        expect(response.data).toEqual({ queue: "embeddingQueue", retried: 1 });
        expect(jobRetry).toHaveBeenCalledTimes(1);
    });
});
import "@/setup/nestia";
