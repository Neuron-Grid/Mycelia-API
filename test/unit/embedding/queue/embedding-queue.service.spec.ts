import type { Job, Queue } from "bullmq";
import type { VectorUpdateJobDto } from "@/embedding/queue/dto/vector-update-job.dto";
import { EmbeddingQueueService } from "@/embedding/queue/embedding-queue.service";
import { EmbeddingBatchDataService } from "@/embedding/services/embedding-batch-data.service";
import type { TableType } from "@/embedding/types/embedding-batch.types";

const PROGRESS_TTL_MS = 15 * 60 * 1000;

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
            add: jest.fn().mockResolvedValue({ id: "new-job-id" }),
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
        queueMock.getJob.mockResolvedValue({
            id: "batch:user-1:tags",
            getState: jest.fn().mockResolvedValue("active"),
            remove: jest.fn(),
        } as unknown as Job<VectorUpdateJobDto>);

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

    it("adds a single embedding update job", async () => {
        await service.addSingleEmbeddingJob("user-1", 10, "tags");

        expect(queueMock.add).toHaveBeenCalledWith(
            "single-update",
            {
                userId: "user-1",
                tableType: "tags",
                recordId: 10,
            },
            { priority: 10 },
        );
    });

    it("adds a global embedding update job", async () => {
        await service.addGlobalEmbeddingUpdateJob();

        expect(queueMock.add).toHaveBeenCalledWith(
            "global-update",
            {},
            { priority: 1 },
        );
    });

    it("returns progress sorted by table type", () => {
        service.initializeBatchProgress("user-1", "tags", 2);
        service.initializeBatchProgress("user-1", "daily_summaries", 1);

        const progress = service.getBatchProgress("user-1");

        expect(progress.map((p) => p.tableType)).toEqual([
            "daily_summaries",
            "tags",
        ]);
    });

    it("marks batch running and preserves progress snapshot", () => {
        service.initializeBatchProgress("user-1", "tags", 3);

        service.markBatchRunning("user-1", "tags", 3);

        const [snapshot] = service.getBatchProgress("user-1");
        expect(snapshot.status).toBe("running");
        expect(snapshot.totalRecords).toBe(3);
    });

    it("keeps progress below 100 when more data remains", () => {
        service.initializeBatchProgress("user-1", "tags", 10);

        const snapshot = service.incrementBatchProgress(
            "user-1",
            "tags",
            5,
            10,
            true,
        );

        expect(snapshot.progress).toBeLessThan(100);
        expect(snapshot.status).toBe("running");
    });

    it("skips enqueue when duplicate job already exists", async () => {
        const existingJob = {
            id: "batch:user-1:tags",
            getState: jest.fn().mockResolvedValue("waiting"),
            remove: jest.fn(),
        } as unknown as Job<VectorUpdateJobDto>;
        queueMock.getJob.mockImplementation((jobId: string) => {
            if (jobId === "batch:user-1:tags") {
                return Promise.resolve(existingJob);
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

    it("removes cached progress immediately after completion", () => {
        service.initializeBatchProgress("user-1", "tags", 5);
        expect(service.getBatchProgress("user-1")).toHaveLength(1);

        service.markBatchCompleted("user-1", "tags");

        expect(service.getBatchProgress("user-1")).toHaveLength(0);
    });

    it("clears cached progress when batch fails", () => {
        service.initializeBatchProgress("user-1", "tags", 5);
        expect(service.getBatchProgress("user-1")).toHaveLength(1);

        service.markBatchFailed("user-1", "tags");

        expect(service.getBatchProgress("user-1")).toHaveLength(0);
    });

    it("returns latest snapshot and evicts cache when batch finishes via increment", () => {
        service.initializeBatchProgress("user-1", "tags", 10);

        const runningSnapshot = service.incrementBatchProgress(
            "user-1",
            "tags",
            4,
            10,
            true,
        );

        expect(runningSnapshot.status).toBe("running");
        expect(service.getBatchProgress("user-1")).toHaveLength(1);

        const completedSnapshot = service.incrementBatchProgress(
            "user-1",
            "tags",
            6,
            10,
            false,
        );

        expect(completedSnapshot.progress).toBe(100);
        expect(completedSnapshot.status).toBe("completed");
        expect(service.getBatchProgress("user-1")).toHaveLength(0);
    });

    it("evicts stale progress entries after TTL elapses", () => {
        jest.useFakeTimers();

        try {
            service.initializeBatchProgress("user-1", "tags", 3);
            expect(service.getBatchProgress("user-1")).toHaveLength(1);

            jest.advanceTimersByTime(PROGRESS_TTL_MS - 1);
            expect(service.getBatchProgress("user-1")).toHaveLength(1);

            jest.advanceTimersByTime(1);
            expect(service.getBatchProgress("user-1")).toHaveLength(0);
        } finally {
            jest.useRealTimers();
        }
    });

    it("extends TTL when progress updates occur", () => {
        jest.useFakeTimers();

        try {
            service.initializeBatchProgress("user-1", "tags", 8);
            jest.advanceTimersByTime(PROGRESS_TTL_MS - 1000);

            service.markBatchRunning("user-1", "tags");

            jest.advanceTimersByTime(999);
            expect(service.getBatchProgress("user-1")).toHaveLength(1);

            jest.advanceTimersByTime(PROGRESS_TTL_MS);
            expect(service.getBatchProgress("user-1")).toHaveLength(0);
        } finally {
            jest.useRealTimers();
        }
    });
});
