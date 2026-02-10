import type { Job, Queue } from "bullmq";
import type { VectorUpdateJobDto } from "@/embedding/queue/dto/vector-update-job.dto";
import { EmbeddingQueueProcessor } from "@/embedding/queue/embedding-queue.processor";
import type { EmbeddingQueueService } from "@/embedding/queue/embedding-queue.service";
import type { EmbeddingBatchDataService } from "@/embedding/services/embedding-batch-data.service";
import type { EmbeddingBatchUpdateService } from "@/embedding/services/embedding-batch-update.service";
import type { EmbeddingService } from "@/search/infrastructure/services/embedding.service";
import type { SupabaseAdminService } from "@/shared/supabase-admin.service";

type BatchDataServiceMock = {
    getSingleItem: jest.Mock;
    getBatchData: jest.Mock;
};

type BatchUpdateServiceMock = {
    updateEmbeddings: jest.Mock;
};

type EmbeddingServiceMock = {
    preprocessText: jest.Mock;
    generateEmbedding: jest.Mock;
    generateEmbeddings: jest.Mock;
};

type EmbeddingQueueServiceMock = {
    markBatchRunning: jest.Mock;
    markBatchCompleted: jest.Mock;
    markBatchWaiting: jest.Mock;
    incrementBatchProgress: jest.Mock;
    markBatchFailed: jest.Mock;
    addUserEmbeddingBatchJob: jest.Mock;
};

const createJob = (
    name: "single-update" | "batch-process" | "global-update",
    data: Partial<VectorUpdateJobDto>,
): Job<VectorUpdateJobDto> =>
    ({
        name,
        data,
        updateProgress: jest.fn(),
        discard: jest.fn(),
    }) as unknown as Job<VectorUpdateJobDto>;

const createSingleJob = (
    data: Partial<VectorUpdateJobDto>,
): Job<VectorUpdateJobDto> =>
    createJob("single-update", {
        userId: "user-1",
        tableType: "tags",
        ...data,
    });

const createBatchJob = (
    data: Partial<VectorUpdateJobDto>,
): Job<VectorUpdateJobDto> =>
    createJob("batch-process", {
        userId: "user-1",
        tableType: "tags",
        batchSize: 50,
        ...data,
    });

const createGlobalJob = (): Job<VectorUpdateJobDto> =>
    createJob("global-update", {});

describe("EmbeddingQueueProcessor single-update", () => {
    let processor: EmbeddingQueueProcessor;
    let batchDataService: BatchDataServiceMock;
    let batchUpdateService: BatchUpdateServiceMock;
    let embeddingService: EmbeddingServiceMock;
    let embeddingQueueService: EmbeddingQueueServiceMock;
    let queue: { add: jest.Mock };

    beforeEach(() => {
        batchDataService = {
            getSingleItem: jest.fn(),
            getBatchData: jest.fn(),
        };
        batchUpdateService = {
            updateEmbeddings: jest.fn(),
        };
        embeddingService = {
            preprocessText: jest.fn(),
            generateEmbedding: jest.fn(),
            generateEmbeddings: jest.fn(),
        };
        embeddingQueueService = {
            markBatchRunning: jest.fn(),
            markBatchCompleted: jest.fn(),
            markBatchWaiting: jest.fn(),
            incrementBatchProgress: jest.fn(),
            markBatchFailed: jest.fn(),
            addUserEmbeddingBatchJob: jest.fn(),
        };
        queue = { add: jest.fn() };

        processor = new EmbeddingQueueProcessor(
            queue as unknown as Queue,
            embeddingQueueService as unknown as EmbeddingQueueService,
            batchDataService as unknown as EmbeddingBatchDataService,
            batchUpdateService as unknown as EmbeddingBatchUpdateService,
            embeddingService as unknown as EmbeddingService,
            {
                getClient: jest.fn().mockReturnValue({
                    rpc: jest.fn(),
                }),
            } as unknown as SupabaseAdminService,
        );
    });

    it("skips when recordId is missing", async () => {
        const job = createSingleJob({});

        const result = await processor.process(job);

        expect(result).toEqual({ processedCount: 0, hasMore: false });
        expect(batchDataService.getSingleItem).not.toHaveBeenCalled();
        expect(batchUpdateService.updateEmbeddings).not.toHaveBeenCalled();
        expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
        expect(job.updateProgress).not.toHaveBeenCalled();
    });

    it("skips when record is not found", async () => {
        batchDataService.getSingleItem.mockResolvedValue(null);

        const job = createSingleJob({ recordId: 123 });

        const result = await processor.process(job);

        expect(result).toEqual({ processedCount: 0, hasMore: false });
        expect(batchDataService.getSingleItem).toHaveBeenCalledWith(
            "user-1",
            "tags",
            123,
        );
        expect(batchUpdateService.updateEmbeddings).not.toHaveBeenCalled();
        expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
        expect(job.updateProgress).not.toHaveBeenCalled();
    });

    it("updates embedding for a single record", async () => {
        batchDataService.getSingleItem.mockResolvedValue({
            id: 123,
            contentText: "hello world",
        });
        embeddingService.preprocessText.mockReturnValue("hello world");
        embeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);

        const job = createSingleJob({ recordId: 123 });

        const result = await processor.process(job);

        expect(result).toEqual({ processedCount: 1, hasMore: false });
        expect(batchDataService.getSingleItem).toHaveBeenCalledWith(
            "user-1",
            "tags",
            123,
        );
        expect(embeddingService.preprocessText).toHaveBeenCalledWith(
            "hello world",
        );
        expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
            "hello world",
        );
        expect(batchUpdateService.updateEmbeddings).toHaveBeenCalledWith(
            "user-1",
            "tags",
            [{ id: 123, embedding: [0.1, 0.2] }],
        );
        expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it("skips when preprocessed content is empty", async () => {
        batchDataService.getSingleItem.mockResolvedValue({
            id: 456,
            contentText: "   ",
        });
        embeddingService.preprocessText.mockReturnValue("");

        const job = createSingleJob({ recordId: 456 });

        const result = await processor.process(job);

        expect(result).toEqual({ processedCount: 0, hasMore: false });
        expect(embeddingService.preprocessText).toHaveBeenCalledWith("   ");
        expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
        expect(batchUpdateService.updateEmbeddings).not.toHaveBeenCalled();
        expect(job.updateProgress).not.toHaveBeenCalled();
    });

    it("discards on non-retriable client errors", async () => {
        batchDataService.getSingleItem.mockResolvedValue({
            id: 789,
            contentText: "hello",
        });
        embeddingService.preprocessText.mockReturnValue("hello");
        embeddingService.generateEmbedding.mockRejectedValue({
            status: 400,
            message: "Bad request",
        });

        const job = createSingleJob({ recordId: 789 });

        await expect(processor.process(job)).rejects.toBeDefined();
        expect(job.discard).toHaveBeenCalled();
        expect(batchUpdateService.updateEmbeddings).not.toHaveBeenCalled();
    });

    it("marks batch completed when no data is returned", async () => {
        batchDataService.getBatchData.mockResolvedValue([]);

        const job = createBatchJob({});

        const result = await processor.process(job);

        expect(result).toEqual({ processedCount: 0, hasMore: false });
        expect(embeddingQueueService.markBatchCompleted).toHaveBeenCalledWith(
            "user-1",
            "tags",
        );
        expect(batchUpdateService.updateEmbeddings).not.toHaveBeenCalled();
    });

    it("processes a batch and finishes without scheduling next batch", async () => {
        batchDataService.getBatchData.mockResolvedValue([
            { id: 1, contentText: "one" },
            { id: 2, contentText: "two" },
        ]);
        embeddingService.generateEmbeddings.mockResolvedValue([[0.1], [0.2]]);
        embeddingQueueService.incrementBatchProgress.mockReturnValue({
            userId: "user-1",
            tableType: "tags",
            status: "completed",
            progress: 100,
            totalRecords: 2,
            processedRecords: 2,
        });

        const job = createBatchJob({});

        const result = await processor.process(job);

        expect(result).toEqual({
            processedCount: 2,
            hasMore: false,
            lastProcessedId: 2,
        });
        expect(batchUpdateService.updateEmbeddings).toHaveBeenCalledWith(
            "user-1",
            "tags",
            [
                { id: 1, embedding: [0.1] },
                { id: 2, embedding: [0.2] },
            ],
        );
        expect(embeddingQueueService.markBatchWaiting).not.toHaveBeenCalled();
        expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it("schedules next batch when more data remains", async () => {
        const batchSize = 2;
        batchDataService.getBatchData.mockResolvedValue([
            { id: 10, contentText: "one" },
            { id: 11, contentText: "two" },
        ]);
        embeddingService.generateEmbeddings.mockResolvedValue([[0.1], [0.2]]);
        embeddingQueueService.incrementBatchProgress.mockReturnValue({
            userId: "user-1",
            tableType: "tags",
            status: "running",
            progress: 50,
            totalRecords: 4,
            processedRecords: 2,
        });

        const job = createBatchJob({ batchSize });

        const result = await processor.process(job);

        expect(result).toEqual({
            processedCount: 2,
            hasMore: true,
            lastProcessedId: 11,
        });
        expect(queue.add).toHaveBeenCalledWith(
            "batch-process",
            expect.objectContaining({
                userId: "user-1",
                tableType: "tags",
                batchSize,
                lastProcessedId: 11,
            }),
            expect.objectContaining({ delay: 2000, priority: 5 }),
        );
        expect(embeddingQueueService.markBatchWaiting).toHaveBeenCalledWith(
            "user-1",
            "tags",
        );
    });

    it("marks batch failed on retriable error", async () => {
        batchDataService.getBatchData.mockResolvedValue([
            { id: 1, contentText: "one" },
        ]);
        embeddingService.generateEmbeddings.mockResolvedValue([[0.1]]);
        batchUpdateService.updateEmbeddings.mockRejectedValue({
            status: 500,
            message: "server error",
        });

        const job = createBatchJob({});

        await expect(processor.process(job)).rejects.toBeDefined();
        expect(embeddingQueueService.markBatchFailed).toHaveBeenCalledWith(
            "user-1",
            "tags",
        );
        expect(job.discard).not.toHaveBeenCalled();
    });

    it("enqueues batch jobs for all active users on global-update", async () => {
        const rpcMock = jest.fn().mockResolvedValue({
            data: [{ user_id: "u1" }, { user_id: "u2" }],
            error: null,
        });
        const admin = {
            getClient: jest.fn().mockReturnValue({ rpc: rpcMock }),
        } as unknown as SupabaseAdminService;
        processor = new EmbeddingQueueProcessor(
            queue as unknown as Queue,
            embeddingQueueService as unknown as EmbeddingQueueService,
            batchDataService as unknown as EmbeddingBatchDataService,
            batchUpdateService as unknown as EmbeddingBatchUpdateService,
            embeddingService as unknown as EmbeddingService,
            admin,
        );
        const job = createGlobalJob();

        const result = await processor.process(job);

        expect(result).toEqual({ processedCount: 0, hasMore: false });
        expect(rpcMock).toHaveBeenCalledWith("fn_list_active_users");
        expect(
            embeddingQueueService.addUserEmbeddingBatchJob,
        ).toHaveBeenCalledTimes(2);
        expect(job.updateProgress).toHaveBeenCalledWith(100);
    });
});
