import { jest } from "@jest/globals";
import type { Job, Queue } from "bullmq";
import { EmbeddingBatchDataService } from "@/embedding/services/embedding-batch-data.service";
import type { TableType } from "@/embedding/types/embedding-batch.types";
import type { VectorUpdateJobDto } from "./dto/vector-update-job.dto";
import { EmbeddingQueueService } from "./embedding-queue.service";

describe("EmbeddingQueueService", () => {
    let service: EmbeddingQueueService;
    let queueMock: {
        add: jest.Mock;
        getJob: jest.Mock;
        getJobCounts: jest.Mock;
    };
    let batchDataServiceMock: {
        getMissingEmbeddingsCount: jest.Mock;
    };

    beforeEach(() => {
        queueMock = {
            add: jest.fn().mockResolvedValue(undefined),
            getJob: jest.fn().mockResolvedValue(null),
            getJobCounts: jest
                .fn()
                .mockResolvedValue({ waiting: 0, active: 0 }),
        };
        batchDataServiceMock = {
            getMissingEmbeddingsCount: jest.fn().mockResolvedValue(5),
        };
        service = new EmbeddingQueueService(
            queueMock as unknown as Queue<VectorUpdateJobDto>,
            batchDataServiceMock as unknown as EmbeddingBatchDataService,
        );
    });

    it("throws when queue saturation exceeds threshold", async () => {
        queueMock.getJobCounts.mockResolvedValue({ waiting: 2, active: 2 });

        await expect(
            service.addUserEmbeddingBatchJob("user-1", ["tags"] as TableType[]),
        ).rejects.toMatchObject({ status: 429 });
        expect(queueMock.add).not.toHaveBeenCalled();
    });

    it("deduplicates table types and assigns deterministic jobIds", async () => {
        batchDataServiceMock.getMissingEmbeddingsCount.mockResolvedValue(10);

        await service.addUserEmbeddingBatchJob("user-1", [
            "feed_items",
            "feed_items",
            "tags",
        ] as TableType[]);

        expect(queueMock.getJobCounts).toHaveBeenCalledTimes(1);
        expect(queueMock.add).toHaveBeenCalledTimes(2);
        expect(queueMock.add).toHaveBeenNthCalledWith(
            1,
            "batch-process",
            expect.objectContaining({
                userId: "user-1",
                tableType: "feed_items",
                totalEstimate: 10,
            }),
            expect.objectContaining({ jobId: "batch:user-1:feed_items" }),
        );
        expect(queueMock.add).toHaveBeenNthCalledWith(
            2,
            "batch-process",
            expect.objectContaining({
                userId: "user-1",
                tableType: "tags",
                totalEstimate: 10,
            }),
            expect.objectContaining({ jobId: "batch:user-1:tags" }),
        );
    });

    it("skips enqueue when duplicate job already exists", async () => {
        queueMock.getJob.mockImplementation((jobId: string) => {
            if (jobId === "batch:user-1:tags") {
                return Promise.resolve({
                    id: jobId,
                } as unknown as Job<VectorUpdateJobDto>);
            }
            return Promise.resolve(null);
        });

        await service.addUserEmbeddingBatchJob("user-1", [
            "tags",
            "feed_items",
        ] as TableType[]);

        expect(queueMock.add).toHaveBeenCalledTimes(1);
        expect(queueMock.add).toHaveBeenCalledWith(
            "batch-process",
            expect.objectContaining({ tableType: "feed_items" }),
            expect.objectContaining({ jobId: "batch:user-1:feed_items" }),
        );
    });
});
