import { ContextIdFactory } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import { jest } from "@test-utils/jest-globals";

import { RequestUserContextService } from "@/auth/application/request-user-context.service";
import type { SearchResultEntity } from "@/search/domain/entities/search-result.entity";
import type { SearchRepository } from "@/search/domain/interfaces/search-repository.interface";
import { SEARCH_REPOSITORY } from "@/search/domain/interfaces/search-repository.interface";
import { SearchCriteria } from "@/search/domain/value-objects/search-criteria.vo";

import { SearchService } from "./search.service";

describe("SearchService", () => {
    let moduleRef: TestingModule;
    let service: SearchService;

    const repositoryMock: jest.Mocked<SearchRepository> = {
        searchAll: jest.fn(),
        searchFeedItems: jest.fn(),
        searchSummaries: jest.fn(),
        searchPodcastEpisodes: jest.fn(),
        updateFeedItemEmbedding: jest.fn(),
        updateSummaryEmbedding: jest.fn(),
        updatePodcastEpisodeEmbedding: jest.fn(),
    };

    const userContextMock: jest.Mocked<RequestUserContextService> = {
        assertSameUser: jest.fn(),
        getCurrentUserId: jest.fn(),
    } as unknown as jest.Mocked<RequestUserContextService>;

    beforeEach(async () => {
        moduleRef = await Test.createTestingModule({
            providers: [
                SearchService,
                {
                    provide: SEARCH_REPOSITORY,
                    useValue: repositoryMock,
                },
                {
                    provide: RequestUserContextService,
                    useValue: userContextMock,
                },
            ],
        }).compile();

        const contextId = ContextIdFactory.create();
        moduleRef.registerRequestByContextId({}, contextId);
        service = await moduleRef.resolve(SearchService, contextId);
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await moduleRef.close();
    });

    const buildResults = (): SearchResultEntity[] => [
        {
            id: 1,
            title: "Result",
            content: "body",
            similarity: 0.9,
            type: "feed_item",
        },
    ];

    it("searchAll validates user and delegates to repository", async () => {
        repositoryMock.searchAll.mockResolvedValue(buildResults());

        const results = await service.searchAll("user-123", {
            query: "Nest",
            limit: 25,
            threshold: 0.4,
            includeTypes: ["feed_item", "podcast"],
        });

        expect(userContextMock.assertSameUser).toHaveBeenCalledWith("user-123");
        expect(repositoryMock.searchAll).toHaveBeenCalledTimes(1);
        const criteriaArg = repositoryMock.searchAll.mock.calls[0][0];
        expect(criteriaArg).toBeInstanceOf(SearchCriteria);
        expect(criteriaArg.query).toBe("Nest");
        expect(criteriaArg.limit).toBe(25);
        expect(criteriaArg.threshold).toBe(0.4);
        expect(criteriaArg.includeTypes).toEqual(["feed_item", "podcast"]);
        expect(results).toHaveLength(1);
    });

    it("searchFeedItems validates user and delegates", async () => {
        repositoryMock.searchFeedItems.mockResolvedValue(buildResults());

        await service.searchFeedItems("user-abc", { query: "rss", limit: 10 });

        expect(userContextMock.assertSameUser).toHaveBeenCalledWith("user-abc");
        expect(repositoryMock.searchFeedItems).toHaveBeenCalledTimes(1);
        const criteriaArg = repositoryMock.searchFeedItems.mock.calls[0][0];
        expect(criteriaArg).toBeInstanceOf(SearchCriteria);
        expect(criteriaArg.query).toBe("rss");
        expect(criteriaArg.limit).toBe(10);
    });

    it("searchSummaries validates user and delegates", async () => {
        repositoryMock.searchSummaries.mockResolvedValue(buildResults());

        await service.searchSummaries("user-xyz", { query: "summary" });

        expect(userContextMock.assertSameUser).toHaveBeenCalledWith("user-xyz");
        expect(repositoryMock.searchSummaries).toHaveBeenCalledTimes(1);
        const criteriaArg = repositoryMock.searchSummaries.mock.calls[0][0];
        expect(criteriaArg).toBeInstanceOf(SearchCriteria);
        expect(criteriaArg.query).toBe("summary");
    });

    it("searchPodcastEpisodes validates user and delegates", async () => {
        repositoryMock.searchPodcastEpisodes.mockResolvedValue(buildResults());

        await service.searchPodcastEpisodes("user-podcast", { query: "pod" });

        expect(userContextMock.assertSameUser).toHaveBeenCalledWith(
            "user-podcast",
        );
        expect(repositoryMock.searchPodcastEpisodes).toHaveBeenCalledTimes(1);
        const criteriaArg =
            repositoryMock.searchPodcastEpisodes.mock.calls[0][0];
        expect(criteriaArg).toBeInstanceOf(SearchCriteria);
        expect(criteriaArg.query).toBe("pod");
    });

    it("updateFeedItemEmbedding validates user and delegates", async () => {
        await service.updateFeedItemEmbedding(
            10,
            "user-embed",
            "Title",
            "Desc",
        );

        expect(userContextMock.assertSameUser).toHaveBeenCalledWith(
            "user-embed",
        );
        expect(repositoryMock.updateFeedItemEmbedding).toHaveBeenCalledWith(
            10,
            "user-embed",
            "Title",
            "Desc",
        );
    });

    it("updateSummaryEmbedding validates user and delegates", async () => {
        await service.updateSummaryEmbedding(20, "user-summary", "Content");

        expect(userContextMock.assertSameUser).toHaveBeenCalledWith(
            "user-summary",
        );
        expect(repositoryMock.updateSummaryEmbedding).toHaveBeenCalledWith(
            20,
            "user-summary",
            "Content",
        );
    });

    it("updatePodcastEpisodeEmbedding validates user and delegates", async () => {
        await service.updatePodcastEpisodeEmbedding(
            30,
            "user-podcast",
            "Title",
        );

        expect(userContextMock.assertSameUser).toHaveBeenCalledWith(
            "user-podcast",
        );
        expect(
            repositoryMock.updatePodcastEpisodeEmbedding,
        ).toHaveBeenCalledWith(30, "user-podcast", "Title");
    });
});
