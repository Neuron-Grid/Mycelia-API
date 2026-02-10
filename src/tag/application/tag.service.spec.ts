import type { EmbeddingQueueService } from "@/embedding/queue/embedding-queue.service";
import { TagRepository } from "../infrastructure/tag.repository";
import { TagService } from "./tag.service";

describe("TagService", () => {
    let service: TagService;
    let tagRepo: jest.Mocked<TagRepository>;
    let embeddingQueueService: jest.Mocked<EmbeddingQueueService>;

    beforeEach(() => {
        tagRepo = {
            findAllTagsByUserId: jest.fn(),
            createTag: jest.fn(),
            updateTag: jest.fn(),
            deleteTag: jest.fn(),
            findTagsByFeedItemId: jest.fn(),
        } as unknown as jest.Mocked<TagRepository>;

        embeddingQueueService = {
            addSingleEmbeddingJob: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<EmbeddingQueueService>;

        service = new TagService(tagRepo, embeddingQueueService);
    });

    describe("getAllTagsForUser", () => {
        it("returns all tags for the user", async () => {
            const mockTags = [
                { id: 1, tag_name: "Tech" },
                { id: 2, tag_name: "News" },
            ];
            tagRepo.findAllTagsByUserId.mockResolvedValue(mockTags as any);

            const result = await service.getAllTagsForUser("u1");

            expect(result).toEqual(mockTags);
            expect(tagRepo.findAllTagsByUserId).toHaveBeenCalledWith("u1");
        });
    });

    describe("createTagForUser", () => {
        it("creates tag and queues embedding", async () => {
            const mockTag = { id: 10, tag_name: "Dev" };
            tagRepo.createTag.mockResolvedValue(mockTag as any);

            const result = await service.createTagForUser("u1", "Dev");

            expect(result).toEqual(mockTag);
            expect(tagRepo.createTag).toHaveBeenCalledWith(
                "u1",
                "Dev",
                undefined,
            );
            expect(
                embeddingQueueService.addSingleEmbeddingJob,
            ).toHaveBeenCalledWith("u1", 10, "tags");
        });

        it("creates tag with parent", async () => {
            const mockTag = { id: 11, tag_name: "NestJS", parent_tag_id: 10 };
            tagRepo.createTag.mockResolvedValue(mockTag as any);

            const result = await service.createTagForUser("u1", "NestJS", 10);

            expect(tagRepo.createTag).toHaveBeenCalledWith("u1", "NestJS", 10);
            expect(result).toEqual(mockTag);
        });
    });

    describe("createTagForUser without embedding service", () => {
        it("works when embeddingQueueService is null", async () => {
            const serviceNoEmbed = new TagService(tagRepo, null);
            const mockTag = { id: 10, tag_name: "Dev" };
            tagRepo.createTag.mockResolvedValue(mockTag as any);

            const result = await serviceNoEmbed.createTagForUser("u1", "Dev");

            expect(result).toEqual(mockTag);
            expect(
                embeddingQueueService.addSingleEmbeddingJob,
            ).not.toHaveBeenCalled();
        });
    });

    describe("updateTagForUser", () => {
        it("updates tag name and queues embedding", async () => {
            const updated = { id: 10, tag_name: "Development" };
            tagRepo.updateTag.mockResolvedValue(updated as any);

            const result = await service.updateTagForUser(
                "u1",
                10,
                "Development",
            );

            expect(result).toEqual(updated);
            expect(tagRepo.updateTag).toHaveBeenCalledWith("u1", 10, {
                tag_name: "Development",
                tag_emb: null,
            });
            expect(
                embeddingQueueService.addSingleEmbeddingJob,
            ).toHaveBeenCalledWith("u1", 10, "tags");
        });

        it("updates tag parent", async () => {
            const updated = { id: 10, parent_tag_id: 5 };
            tagRepo.updateTag.mockResolvedValue(updated as any);

            await service.updateTagForUser("u1", 10, undefined, 5);

            expect(tagRepo.updateTag).toHaveBeenCalledWith("u1", 10, {
                parent_tag_id: 5,
            });
        });
    });

    describe("deleteTagForUser", () => {
        it("delegates to repository", async () => {
            tagRepo.deleteTag.mockResolvedValue(undefined as any);

            await service.deleteTagForUser("u1", 10);

            expect(tagRepo.deleteTag).toHaveBeenCalledWith("u1", 10);
        });
    });
});
