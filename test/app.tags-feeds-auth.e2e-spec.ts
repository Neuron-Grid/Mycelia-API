/**
 * E2E tests covering Tags / Feeds / Auth happy paths with in-memory stubs.
 * RUN_APP_E2E=true 環境下のみ実行。
 */

import { jest } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { User } from "@supabase/supabase-js";
import cookieParser from "cookie-parser";
import request, { SuperAgentTest } from "supertest";
import { AppModule } from "@/app.module";
import { AuthService } from "@/auth/auth.service";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { WebAuthnService } from "@/auth/webauthn.service";
import { createCsrfMiddleware } from "@/common/middleware/security.middleware";
import { FeedItemService } from "@/feed/application/feed-item.service";
import { FeedUseCaseService } from "@/feed/application/feed-usecase.service";
import { SubscriptionService } from "@/feed/application/subscription.service";
import { TagService } from "@/tag/application/tag.service";

// Reuse the module stubs defined in test/app.e2e-spec.ts to avoid external dependencies
jest.mock("@nestjs/bullmq", () => {
    class BullMqStubModule {}
    class WorkerHost {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: stub only
        process() {}
    }

    const createDynamicModule = () => ({
        module: BullMqStubModule,
        providers: [],
        exports: [],
    });

    return {
        BullModule: {
            registerQueueAsync: () => createDynamicModule(),
            registerQueue: () => createDynamicModule(),
            forRootAsync: () => createDynamicModule(),
        },
        InjectQueue: () => () => undefined,
        Processor: () => (cls: unknown) => cls,
        WorkerHost,
    };
});
jest.mock("@/podcast/podcast.module", () => ({ PodcastModule: class {} }));
jest.mock("@/podcast/queue/podcast-queue.module", () => ({
    PodcastQueueModule: class {},
}));
jest.mock("@/podcast/core/podcast-core.module", () => ({
    PodcastCoreModule: class {},
}));
jest.mock("@/podcast/podcast-tts.service", () => ({
    PodcastTtsService: class {},
}));
jest.mock("@/embedding/queue/embedding-queue.module", () => ({
    EmbeddingQueueModule: class {},
}));
jest.mock("@/embedding/queue/embedding-queue.service", () => ({
    EmbeddingQueueService: class {},
}));
jest.mock("@/feed/queue/feed-queue.module", () => ({
    FeedQueueModule: class {},
}));
jest.mock("@/maintenance/maintenance-queue.module", () => ({
    MaintenanceQueueModule: class {},
}));
jest.mock("@/llm/llm.module", () => ({ LlmModule: class {} }));
jest.mock("@/shared/redis/redis.module", () => ({ RedisModule: class {} }));
jest.mock("@/shared/redis/redis.service", () => ({ RedisService: class {} }));
jest.mock("@/shared/lock/distributed-lock.module", () => ({
    DistributedLockModule: class {},
}));
jest.mock("@/shared/lock/distributed-lock.service", () => ({
    DistributedLockService: class {
        acquire() {
            return "mock-lock";
        }
        release() {
            return true;
        }
    },
}));
const runAppE2E = process.env.RUN_APP_E2E === "true";
const describeOrSkip = runAppE2E ? describe : describe.skip;

const supabaseUserFixture: User = {
    id: "user-1",
    aud: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: { username: "userOne" },
    email: "user@example.com",
    created_at: "2024-01-01T00:00:00.000Z",
    confirmed_at: "2024-01-02T00:00:00.000Z",
    email_confirmed_at: "2024-01-02T00:00:00.000Z",
    last_sign_in_at: "2024-01-10T12:00:00.000Z",
    role: "authenticated",
    updated_at: "2024-01-10T12:00:00.000Z",
    identities: [],
    factors: [],
    is_anonymous: false,
    is_sso_user: false,
};

const expectCamelCaseAuthUserDto = (user: unknown) => {
    expect(user).toEqual(
        expect.objectContaining({
            id: supabaseUserFixture.id,
            email: supabaseUserFixture.email,
            createdAt: supabaseUserFixture.created_at,
            appMetadata: supabaseUserFixture.app_metadata,
            userMetadata: supabaseUserFixture.user_metadata,
            emailConfirmedAt: supabaseUserFixture.email_confirmed_at,
        }),
    );
    expect(user).not.toHaveProperty("created_at");
    expect(user).not.toHaveProperty("app_metadata");
    expect(user).not.toHaveProperty("user_metadata");
};

class AllowAuthGuard {
    canActivate(context: Parameters<SupabaseAuthGuard["canActivate"]>[0]) {
        const req = context.switchToHttp().getRequest();
        req.user = { ...supabaseUserFixture } as User;
        return true;
    }
}

describeOrSkip("Tags / Feeds / Auth happy-path (e2e)", () => {
    let app: INestApplication;
    let agent: SuperAgentTest;

    const tagRows = [
        {
            id: 1,
            user_id: "user-1",
            tag_name: "Tech",
            parent_tag_id: null,
            description: null,
            color: null,
            soft_deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
    ];

    const tagServiceStub = {
        getAllTagsForUser: jest.fn().mockResolvedValue(tagRows),
        createTagForUser: jest
            .fn()
            .mockImplementation(async (_userId: string, tagName: string) => ({
                ...tagRows[0],
                id: 2,
                tag_name: tagName,
            })),
    };

    const subscriptionServiceStub = {
        getSubscriptionsPaginated: jest.fn().mockResolvedValue({
            data: [
                {
                    id: 10,
                    user_id: "user-1",
                    feed_url: "https://example.com/rss.xml",
                    feed_title: "Example Feed",
                    last_fetched_at: null,
                    next_fetch_at: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    soft_deleted: false,
                },
            ],
            page: 1,
            limit: 100,
            total: 1,
        }),
        addSubscription: jest.fn().mockResolvedValue({
            id: 10,
            user_id: "user-1",
            feed_url: "https://example.com/rss.xml",
            feed_title: "Example Feed",
            last_fetched_at: null,
            next_fetch_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            soft_deleted: false,
        }),
    };

    const feedUseCaseServiceStub = {
        fetchFeedMeta: jest.fn().mockResolvedValue({
            meta: { title: "Fetched Feed" },
            items: [],
        }),
        fetchFeedItems: jest.fn().mockResolvedValue({
            feedTitle: "Fetched Feed",
            insertedCount: 1,
            lastFetchedAt: new Date().toISOString(),
        }),
    };

    const feedItemServiceStub = {
        getFeedItemsPaginated: jest.fn().mockResolvedValue({
            data: [
                {
                    id: 100,
                    user_subscription_id: 10,
                    user_id: "user-1",
                    title: "Item",
                    link: "https://example.com/item",
                    link_hash: "hash",
                    description: "desc",
                    published_at: new Date().toISOString(),
                    title_emb: null,
                    soft_deleted: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    isFavorite: false,
                    tags: [],
                },
            ],
            page: 1,
            limit: 100,
            total: 1,
        }),
    };

    const authServiceStub = {
        signIn: jest.fn().mockResolvedValue({
            user: { ...supabaseUserFixture },
            session: {
                access_token: "access-token",
                refresh_token: "refresh-token",
            },
        }),
        signUp: jest.fn(),
        refreshSession: jest.fn(),
        signOut: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        verifyEmail: jest.fn(),
        enrollTotp: jest.fn(),
        disableTotp: jest.fn(),
        verifyTotp: jest.fn(),
        updateEmail: jest.fn(),
        updatePassword: jest.fn(),
        updateUsername: jest.fn(),
        startWebAuthnRegistration: jest.fn(),
        finishWebAuthnRegistration: jest.fn(),
        verifyWebAuthnAssertion: jest.fn(),
    };

    beforeAll(async () => {
        process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "http://local";
        process.env.SUPABASE_ANON_KEY =
            process.env.SUPABASE_ANON_KEY ?? "anon-key";
        process.env.SUPABASE_SERVICE_ROLE_KEY =
            process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-key";
        process.env.CORS_ORIGIN = "https://app.example.com";

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideGuard(SupabaseAuthGuard)
            .useClass(AllowAuthGuard)
            .overrideGuard(ThrottlerGuard)
            .useValue({ canActivate: () => true })
            .overrideProvider(TagService)
            .useValue(tagServiceStub)
            .overrideProvider(SubscriptionService)
            .useValue(subscriptionServiceStub)
            .overrideProvider(FeedUseCaseService)
            .useValue(feedUseCaseServiceStub)
            .overrideProvider(FeedItemService)
            .useValue(feedItemServiceStub)
            .overrideProvider(AuthService)
            .useValue(authServiceStub)
            .overrideProvider(WebAuthnService)
            .useValue({});

        app = moduleFixture.createNestApplication();
        const cfg = app.get(ConfigService);
        app.use(cookieParser());
        app.use(createCsrfMiddleware(cfg));
        app.setGlobalPrefix("api/v1");
        await app.init();
        agent = request.agent(app.getHttpServer());
    });

    afterAll(async () => {
        await app?.close();
    });

    const extractXsrfFrom = (setCookieHeader: string[] | undefined) => {
        if (!setCookieHeader) return null;
        const xsrfCookie = setCookieHeader.find((c) =>
            c.startsWith("XSRF-TOKEN="),
        );
        if (!xsrfCookie) return null;
        const match = xsrfCookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? match[1] : null;
    };

    const prepareCsrfToken = async (): Promise<string> => {
        const res = await agent.get("/api/v1/auth/login").expect(404);
        const token = extractXsrfFrom(res.headers["set-cookie"]);
        if (!token) {
            throw new Error("Failed to obtain XSRF token");
        }
        return token;
    };

    it("returns user tags via mocked TagService", async () => {
        const csrfToken = await prepareCsrfToken();
        const res = await agent
            .get("/api/v1/tags")
            .set("X-CSRF-Token", csrfToken)
            .expect(200);

        expect(res.body.data).toEqual([
            expect.objectContaining({ tagName: "Tech" }),
        ]);
        expect(tagServiceStub.getAllTagsForUser).toHaveBeenCalledWith("user-1");
    });

    it("creates tag successfully when CSRF token provided", async () => {
        const csrfToken = await prepareCsrfToken();
        const res = await agent
            .post("/api/v1/tags")
            .set("X-CSRF-Token", csrfToken)
            .send({ tagName: "NewTag" })
            .expect(201);

        expect(tagServiceStub.createTagForUser).toHaveBeenCalledWith(
            "user-1",
            "NewTag",
            null,
        );
        expect(res.body.data).toEqual(
            expect.objectContaining({ tagName: "NewTag" }),
        );
    });

    it("adds subscription via Feed controller", async () => {
        const csrfToken = await prepareCsrfToken();
        const res = await agent
            .post("/api/v1/feed")
            .set("X-CSRF-Token", csrfToken)
            .send({ feedUrl: "https://example.com/rss.xml" })
            .expect(201);

        expect(feedUseCaseServiceStub.fetchFeedMeta).toHaveBeenCalledWith(
            "https://example.com/rss.xml",
        );
        expect(subscriptionServiceStub.addSubscription).toHaveBeenCalled();
        expect(res.body.data.feedUrl).toBe("https://example.com/rss.xml");
    });

    it("allows login without CSRF token when JSON payload from trusted origin", async () => {
        const res = await request(app.getHttpServer())
            .post("/api/v1/auth/login")
            .set("Origin", "https://app.example.com")
            .send({ email: "user@example.com", password: "password" })
            .expect(200);

        expect(authServiceStub.signIn).toHaveBeenCalledWith(
            "user@example.com",
            "password",
        );
        expect(res.headers["set-cookie"]).toEqual(
            expect.arrayContaining([
                expect.stringContaining("__Host-access_token=access-token"),
                expect.stringContaining("__Secure-refresh_token=refresh-token"),
            ]),
        );
        expect(res.body.data.user).toBeTruthy();
        expectCamelCaseAuthUserDto(res.body.data.user);
    });

    it("rejects login when content-type is form encoded", async () => {
        await request(app.getHttpServer())
            .post("/api/v1/auth/login")
            .set("Origin", "https://app.example.com")
            .set("Content-Type", "application/x-www-form-urlencoded")
            .send("email=user%40example.com&password=password")
            .expect(403);
    });

    it("rejects login from untrusted origin", async () => {
        await request(app.getHttpServer())
            .post("/api/v1/auth/login")
            .set("Origin", "https://evil.example")
            .send({ email: "user@example.com", password: "password" })
            .expect(403);
    });

    it("allows login when CSRF token matches cookie", async () => {
        const csrfToken = await prepareCsrfToken();
        const res = await agent
            .post("/api/v1/auth/login")
            .set("X-CSRF-Token", csrfToken)
            .set("Origin", "https://app.example.com")
            .send({ email: "user@example.com", password: "password" })
            .expect(200);

        expect(authServiceStub.signIn).toHaveBeenCalledWith(
            "user@example.com",
            "password",
        );
        expect(res.headers["set-cookie"]).toEqual(
            expect.arrayContaining([
                expect.stringContaining("__Host-access_token=access-token"),
                expect.stringContaining("__Secure-refresh_token=refresh-token"),
            ]),
        );
        expect(res.body.data.user).toBeTruthy();
        expectCamelCaseAuthUserDto(res.body.data.user);
    });

    it("returns profile with camelCase user DTO", async () => {
        const res = await agent.get("/api/v1/auth/profile").expect(200);

        expect(res.body.message).toBe("User profile fetched successfully");
        expectCamelCaseAuthUserDto(res.body.data);
    });
});
