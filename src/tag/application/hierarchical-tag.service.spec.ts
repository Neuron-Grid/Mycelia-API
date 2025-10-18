import { jest } from "@jest/globals";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EmbeddingQueueService } from "@/embedding/queue/embedding-queue.service";
import { EmbeddingService } from "@/search/infrastructure/services/embedding.service";
import { TagEntity } from "@/tag/domain/tag.entity";
import { TagRepository } from "@/tag/infrastructure/tag.repository";
import { HierarchicalTagService } from "./hierarchical-tag.service";

const createTag = (overrides: Partial<TagEntity>): TagEntity => {
    const base = {
        id: overrides.id ?? 1,
        user_id: overrides.user_id ?? "user-1",
        tag_name: overrides.tag_name ?? "tag",
        parent_tag_id:
            overrides.parent_tag_id === undefined
                ? null
                : overrides.parent_tag_id,
        soft_deleted: overrides.soft_deleted ?? false,
        created_at: overrides.created_at ?? new Date().toISOString(),
        updated_at: overrides.updated_at ?? new Date().toISOString(),
        path: overrides.path ?? [],
        description: overrides.description ?? null,
        color: overrides.color ?? null,
        tag_emb: overrides.tag_emb ?? null,
    };
    return new TagEntity(base);
};

describe("HierarchicalTagService", () => {
    let service: HierarchicalTagService;
    let tagRepository: {
        findById: jest.Mock;
        findByNameAndParent: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        findByUser: jest.Mock;
        tagSubscription: jest.Mock;
        tagFeedItem: jest.Mock;
    };
    let embeddingService: {
        preprocessText: jest.Mock;
        generateEmbedding: jest.Mock;
    };
    let embeddingQueueService: { addSingleEmbeddingJob: jest.Mock };

    const userId = "user-1";

    beforeEach(() => {
        tagRepository = {
            findById: jest.fn(),
            findByNameAndParent: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findByUser: jest.fn(),
            tagSubscription: jest.fn(),
            tagFeedItem: jest.fn(),
        };
        embeddingService = {
            preprocessText: jest.fn((text: string) => `processed:${text}`),
            generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]),
        };
        embeddingQueueService = {
            addSingleEmbeddingJob: jest.fn().mockResolvedValue(undefined),
        };

        service = new HierarchicalTagService(
            tagRepository as unknown as TagRepository,
            embeddingService as unknown as EmbeddingService,
            embeddingQueueService as unknown as EmbeddingQueueService,
        );
    });

    describe("createHierarchicalTag", () => {
        it("creates a root tag, generates embeddings, and enqueues follow-up job", async () => {
            const created = createTag({ id: 99, tag_name: "Tech" });
            tagRepository.findByNameAndParent.mockResolvedValue(null);
            tagRepository.create.mockResolvedValue(created);

            const result = await service.createHierarchicalTag(userId, {
                tagName: "Tech",
            });

            expect(tagRepository.findByNameAndParent).toHaveBeenCalledWith(
                userId,
                "Tech",
                null,
            );
            expect(embeddingService.preprocessText).toHaveBeenCalledWith(
                "Tech",
            );
            expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
                "processed:Tech",
            );
            expect(tagRepository.create).toHaveBeenCalledWith(userId, {
                tag_name: "Tech",
                parent_tag_id: null,
                description: undefined,
                color: undefined,
                tag_emb: [0.1, 0.2],
            });
            expect(
                embeddingQueueService.addSingleEmbeddingJob,
            ).toHaveBeenCalledWith(userId, 99, "tags");
            expect(result).toBe(created);
        });

        it("continues creation when embedding generation fails", async () => {
            const created = createTag({ id: 42, tag_name: "AI" });
            tagRepository.findByNameAndParent.mockResolvedValue(null);
            tagRepository.create.mockResolvedValue(created);
            embeddingService.generateEmbedding.mockRejectedValue(
                new Error("embedding service down"),
            );

            const result = await service.createHierarchicalTag(userId, {
                tagName: "AI",
                description: "Artificial Intelligence",
            });

            expect(tagRepository.create).toHaveBeenCalled();
            expect(
                embeddingQueueService.addSingleEmbeddingJob,
            ).toHaveBeenCalledWith(userId, 42, "tags");
            expect(result).toBe(created);
        });

        it("throws when parent tag does not exist", async () => {
            tagRepository.findById.mockResolvedValue(null);

            await expect(
                service.createHierarchicalTag(userId, {
                    tagName: "Child",
                    parentTagId: 10,
                }),
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it("throws when parent depth exceeds maximum", async () => {
            const tagChain = new Map<number, TagEntity>([
                [10, createTag({ id: 10, parent_tag_id: 9 })],
                [9, createTag({ id: 9, parent_tag_id: 8 })],
                [8, createTag({ id: 8, parent_tag_id: 7 })],
                [7, createTag({ id: 7, parent_tag_id: 6 })],
                [6, createTag({ id: 6, parent_tag_id: null })],
            ]);

            tagRepository.findById.mockImplementation((id: number) =>
                Promise.resolve(tagChain.get(id) ?? null),
            );
            tagRepository.findByNameAndParent.mockResolvedValue(null);

            await expect(
                service.createHierarchicalTag(userId, {
                    tagName: "TooDeep",
                    parentTagId: 10,
                }),
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it("throws when duplicate tag exists under same parent", async () => {
            tagRepository.findByNameAndParent.mockResolvedValue(
                createTag({ id: 1, tag_name: "Duplicate" }),
            );

            await expect(
                service.createHierarchicalTag(userId, {
                    tagName: "Duplicate",
                }),
            ).rejects.toBeInstanceOf(BadRequestException);
        });
    });

    describe("moveTag", () => {
        it("moves tag to a new parent and enqueues embedding update", async () => {
            const tagToMove = createTag({ id: 5, parent_tag_id: null });
            const newParent = createTag({ id: 7, parent_tag_id: null });
            const updated = createTag({ id: 5, parent_tag_id: 7 });

            tagRepository.findById.mockImplementation((id: number) => {
                if (id === 5) return Promise.resolve(tagToMove);
                if (id === 7) return Promise.resolve(newParent);
                return Promise.resolve(null);
            });
            tagRepository.findByUser.mockResolvedValue([
                tagToMove,
                newParent,
                createTag({ id: 8, parent_tag_id: 5 }),
            ]);
            tagRepository.update.mockResolvedValue(updated);

            const result = await service.moveTag(userId, 5, 7);

            expect(tagRepository.update).toHaveBeenCalledWith(5, userId, {
                parent_tag_id: 7,
            });
            expect(
                embeddingQueueService.addSingleEmbeddingJob,
            ).toHaveBeenCalledWith(userId, 5, "tags");
            expect(result).toBe(updated);
        });

        it("rejects when moving tag to its own descendant", async () => {
            const tagToMove = createTag({ id: 5, parent_tag_id: null });
            const child = createTag({ id: 6, parent_tag_id: 5 });

            tagRepository.findById.mockImplementation((id: number) => {
                if (id === 5) return Promise.resolve(tagToMove);
                if (id === 6) return Promise.resolve(child);
                return Promise.resolve(null);
            });
            tagRepository.findByUser.mockResolvedValue([tagToMove, child]);

            await expect(service.moveTag(userId, 5, 6)).rejects.toBeInstanceOf(
                BadRequestException,
            );
            expect(tagRepository.update).not.toHaveBeenCalled();
        });

        it("rejects when moving would exceed depth limit", async () => {
            const tagToMove = createTag({ id: 11, parent_tag_id: null });
            const newParent = createTag({ id: 20, parent_tag_id: 19 });
            const chain = [
                newParent,
                createTag({ id: 19, parent_tag_id: 18 }),
                createTag({ id: 18, parent_tag_id: 17 }),
                createTag({ id: 17, parent_tag_id: 16 }),
                createTag({ id: 16, parent_tag_id: null }),
            ];
            const child = createTag({ id: 12, parent_tag_id: 11 });

            tagRepository.findById.mockImplementation((id: number) => {
                if (id === 11) return Promise.resolve(tagToMove);
                const found = [newParent, ...chain.slice(1)].find(
                    (tag) => tag.id === id,
                );
                return Promise.resolve(found ?? null);
            });
            tagRepository.findByUser.mockResolvedValue([
                tagToMove,
                child,
                ...chain,
            ]);

            await expect(
                service.moveTag(userId, 11, 20),
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(tagRepository.update).not.toHaveBeenCalled();
        });

        it("throws when tag to move does not exist", async () => {
            tagRepository.findById.mockResolvedValue(null);

            await expect(service.moveTag(userId, 99, 1)).rejects.toBeInstanceOf(
                NotFoundException,
            );
        });

        it("throws when new parent does not exist", async () => {
            const tagToMove = createTag({ id: 1 });
            tagRepository.findById.mockImplementation((id: number) => {
                if (id === 1) return Promise.resolve(tagToMove);
                return Promise.resolve(null);
            });

            await expect(
                service.moveTag(userId, 1, 999),
            ).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
