import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";
import type { Job, Queue } from "bullmq";
import type { MaintenanceService } from "@/maintenance/maintenance.service";
import { MaintenanceQueueProcessor } from "@/maintenance/maintenance-queue.processor";
import type { WorkerUserSettingsRepository } from "@/shared/settings/worker-user-settings.repository";
import { JstDateService } from "@/shared/time/jst-date.service";

type ScheduleTickData = {
    summaryOffset?: number;
    podcastOffset?: number;
    processSummary?: boolean;
    processPodcast?: boolean;
    tickId?: string;
};

const createQueueMock = () => ({
    add: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue(undefined),
});

const createProcessor = (dateIso: string) => {
    const maintenanceService = {
        rebuildVectorIndexes: jest.fn(),
    } as unknown as MaintenanceService;

    const feedQueue = createQueueMock() as unknown as Queue;
    const embeddingQueue = createQueueMock() as unknown as Queue;
    const summaryQueue = createQueueMock() as unknown as Queue;
    const scriptQueue = createQueueMock() as unknown as Queue;
    const podcastQueue = createQueueMock() as unknown as Queue;
    const accountDeletionQueue = createQueueMock() as unknown as Queue;
    const maintenanceQueue = createQueueMock() as unknown as Queue;

    const userSettingsRepo = {
        getAllEnabledSummarySchedules: jest.fn().mockResolvedValue([]),
        getAllEnabledPodcastSchedules: jest.fn().mockResolvedValue([]),
    } as unknown as WorkerUserSettingsRepository;

    const time = new JstDateService();
    jest.spyOn(time, "now").mockReturnValue(new Date(dateIso));

    const processor = new MaintenanceQueueProcessor(
        maintenanceService,
        feedQueue,
        embeddingQueue,
        summaryQueue,
        scriptQueue,
        podcastQueue,
        accountDeletionQueue,
        maintenanceQueue,
        userSettingsRepo,
        time,
    );

    return {
        processor,
        maintenanceQueue,
        accountDeletionQueue,
    };
};

const invokeHandleScheduleTick = async (
    processor: MaintenanceQueueProcessor,
    job: Job<ScheduleTickData, unknown, string>,
) => {
    const handler = Reflect.get(processor, "handleScheduleTick") as (
        job: Job<ScheduleTickData, unknown, string>,
    ) => Promise<void>;
    await handler.call(processor, job);
};

describe("MaintenanceQueueProcessor handleScheduleTick", () => {
    beforeEach(() => {
        jest.spyOn(
            JstDateService.prototype,
            "warnIfTimezoneMismatch",
        ).mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("enqueues weekly reindex on Sunday 03:00 JST", async () => {
        const { processor, maintenanceQueue } = createProcessor(
            "2024-05-11T18:00:00.000Z",
        );

        const job = {
            data: { processSummary: true, processPodcast: true },
            timestamp: Date.parse("2024-05-11T18:00:00.000Z"),
            id: "job-1",
        } as unknown as Job<ScheduleTickData, unknown, string>;

        await invokeHandleScheduleTick(processor, job);

        expect(maintenanceQueue.add).toHaveBeenCalledWith(
            "weeklyReindex",
            {},
            expect.objectContaining({ jobId: "weekly-reindex:2024-05-12" }),
        );
    });

    it("enqueues account deletion aggregation on Monday 03:00 JST", async () => {
        const { processor, accountDeletionQueue } = createProcessor(
            "2024-05-12T18:00:00.000Z",
        );

        const job = {
            data: { processSummary: true, processPodcast: true },
            timestamp: Date.parse("2024-05-12T18:00:00.000Z"),
            id: "job-2",
        } as unknown as Job<ScheduleTickData, unknown, string>;

        await invokeHandleScheduleTick(processor, job);

        expect(accountDeletionQueue.add).toHaveBeenCalledWith(
            "aggregateDeletion",
            {},
            expect.objectContaining({ jobId: "account-aggregate:2024-05-13" }),
        );
    });
});
