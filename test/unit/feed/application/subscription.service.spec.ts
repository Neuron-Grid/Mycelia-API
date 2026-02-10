import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { FeedQueueService } from "@/feed/queue/feed-queue.service";
import type { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import type { SubscriptionRepository } from "@/feed/infrastructure/subscription.repository";
import { SubscriptionService } from "@/feed/application/subscription.service";

describe("SubscriptionService", () => {
    let service: SubscriptionService;
    let repo: jest.Mocked<SubscriptionRepository>;
    let feedQueueService: jest.Mocked<FeedQueueService>;
    let userSettingsRepo: jest.Mocked<UserSettingsRepository>;

    const mockSub = {
        id: 1,
        user_id: "u1",
        feed_url: "https://example.com/feed",
        feed_title: "Example",
        last_fetched_at: null,
        next_fetch_at: null,
    };

    beforeEach(() => {
        repo = {
            findByUserIdPaginated: jest.fn(),
            findOne: jest.fn(),
            findDueSubscriptions: jest.fn(),
            findDueSubscriptionsByUser: jest.fn(),
            insertSubscription: jest.fn(),
            updateLastFetched: jest.fn(),
            updateSubscriptionTitle: jest.fn(),
            deleteSubscription: jest.fn(),
            updateNextFetchAt: jest.fn(),
        } as unknown as jest.Mocked<SubscriptionRepository>;

        feedQueueService = {
            addFeedJob: jest.fn(),
        } as unknown as jest.Mocked<FeedQueueService>;

        userSettingsRepo = {
            upsertRefreshInterval: jest.fn(),
        } as unknown as jest.Mocked<UserSettingsRepository>;

        service = new SubscriptionService(
            repo,
            feedQueueService,
            userSettingsRepo,
        );
    });

    describe("getSubscriptionsPaginated", () => {
        it("returns paginated subscriptions from repo", async () => {
            const paginated = {
                data: [mockSub],
                total: 1,
                page: 1,
                limit: 10,
            };
            repo.findByUserIdPaginated.mockResolvedValue(paginated as any);

            const result = await service.getSubscriptionsPaginated("u1", 1, 10);

            expect(result).toEqual(paginated);
            expect(repo.findByUserIdPaginated).toHaveBeenCalledWith(
                "u1",
                1,
                10,
            );
        });
    });

    describe("getSubscriptionById", () => {
        it("returns subscription from repo", async () => {
            repo.findOne.mockResolvedValue(mockSub as any);
            const result = await service.getSubscriptionById("u1", 1);
            expect(result).toEqual(mockSub);
            expect(repo.findOne).toHaveBeenCalledWith(1, "u1");
        });
    });

    describe("addSubscription", () => {
        it("adds valid subscription", async () => {
            repo.insertSubscription.mockResolvedValue(mockSub as any);

            const result = await service.addSubscription(
                "u1",
                "https://example.com/feed",
                "Example",
            );

            expect(result).toEqual(mockSub);
            expect(repo.insertSubscription).toHaveBeenCalledWith(
                "u1",
                "https://example.com/feed",
                "Example",
            );
        });

        it("rejects invalid URL", async () => {
            await expect(
                service.addSubscription("u1", "not-a-url", "Bad"),
            ).rejects.toThrow(BadRequestException);
        });

        it("rejects non-http protocol", async () => {
            await expect(
                service.addSubscription("u1", "ftp://example.com/feed", "FTP"),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe("markFetched", () => {
        it("delegates to repo", async () => {
            const now = new Date();
            repo.updateLastFetched.mockResolvedValue(undefined);

            await service.markFetched(1, "u1", now);

            expect(repo.updateLastFetched).toHaveBeenCalledWith(1, "u1", now);
        });
    });

    describe("updateSubscription", () => {
        it("updates subscription title", async () => {
            repo.findOne.mockResolvedValue(mockSub as any);
            repo.updateSubscriptionTitle.mockResolvedValue({
                ...mockSub,
                feed_title: "New Title",
            } as any);

            const result = await service.updateSubscription("u1", 1, {
                feedTitle: "New Title",
            });

            expect(result.feed_title).toBe("New Title");
        });

        it("throws when subscription not found", async () => {
            repo.findOne.mockResolvedValue(null as any);

            await expect(
                service.updateSubscription("u1", 99, {
                    feedTitle: "Whatever",
                }),
            ).rejects.toThrow("Subscription not found");
        });
    });

    describe("deleteSubscription", () => {
        it("deletes existing subscription", async () => {
            repo.findOne.mockResolvedValue(mockSub as any);
            repo.deleteSubscription.mockResolvedValue(undefined);

            await service.deleteSubscription("u1", 1);

            expect(repo.deleteSubscription).toHaveBeenCalledWith(1, "u1");
        });

        it("throws when subscription not found", async () => {
            repo.findOne.mockResolvedValue(null as any);

            await expect(service.deleteSubscription("u1", 99)).rejects.toThrow(
                "Subscription not found",
            );
        });
    });

    describe("refreshSubscription", () => {
        it("enqueues feed job and returns result", async () => {
            repo.findOne.mockResolvedValue(mockSub as any);
            feedQueueService.addFeedJob.mockResolvedValue({
                jobId: "job-1",
            } as any);
            repo.updateNextFetchAt.mockResolvedValue({
                ...mockSub,
                next_fetch_at: "2024-01-01T00:00:00Z",
            } as any);

            const result = await service.refreshSubscription("u1", 1);

            expect(result.jobId).toBe("job-1");
            expect(result.message).toBe("Subscription refresh enqueued");
            expect(feedQueueService.addFeedJob).toHaveBeenCalledWith(
                1,
                "u1",
                "https://example.com/feed",
                "Example",
            );
        });

        it("throws NotFoundException when sub not found", async () => {
            repo.findOne.mockResolvedValue(null as any);

            await expect(service.refreshSubscription("u1", 99)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe("findDueSubscriptions", () => {
        it("delegates to repo", async () => {
            const cutoff = new Date();
            repo.findDueSubscriptions.mockResolvedValue([mockSub] as any);

            const result = await service.findDueSubscriptions(cutoff);

            expect(result).toEqual([mockSub]);
        });
    });
});
