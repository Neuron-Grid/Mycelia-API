import { jest } from "@jest/globals";
import { Queue } from "bullmq";
import { UserSettingsRepository } from "@/shared/settings/user-settings.repository";
import { SummaryScriptService } from "./summary-script.service";

describe("SummaryScriptService", () => {
    let summaryQueue: { add: jest.Mock };
    let scriptQueue: { add: jest.Mock };
    let userSettingsRepo: { getByUserId: jest.Mock };
    let service: SummaryScriptService;

    beforeEach(() => {
        jest.useFakeTimers();
        summaryQueue = {
            add: jest.fn().mockResolvedValue({ id: "summary-job" }),
        };
        scriptQueue = {
            add: jest.fn().mockResolvedValue({ id: "script-job" }),
        };
        userSettingsRepo = { getByUserId: jest.fn().mockResolvedValue(null) };

        service = new SummaryScriptService(
            summaryQueue as unknown as Queue,
            scriptQueue as unknown as Queue,
            userSettingsRepo as unknown as UserSettingsRepository,
        );
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("enqueues summary generation when feature enabled", async () => {
        jest.setSystemTime(new Date("2025-10-16T18:15:00Z"));
        userSettingsRepo.getByUserId.mockResolvedValue({
            summary_enabled: true,
        });
        summaryQueue.add.mockResolvedValue({ id: "summary:user-1:2025-10-17" });

        const result = await service.requestSummaryGeneration("user-1");

        expect(userSettingsRepo.getByUserId).toHaveBeenCalledWith("user-1");
        expect(summaryQueue.add).toHaveBeenCalledWith(
            "generateUserSummary",
            expect.objectContaining({ userId: "user-1" }),
            expect.objectContaining({
                jobId: "summary:user-1:2025-10-17",
                removeOnComplete: 5,
                removeOnFail: 10,
                attempts: 3,
            }),
        );
        expect(result).toEqual({ jobId: "summary:user-1:2025-10-17" });
    });

    it("skips enqueue when summary feature disabled", async () => {
        userSettingsRepo.getByUserId.mockResolvedValue({
            summary_enabled: false,
        });

        const result = await service.requestSummaryGeneration("user-2");

        expect(summaryQueue.add).not.toHaveBeenCalled();
        expect(result).toEqual({ jobId: undefined });
    });

    it("enqueues script generation job with provided parameters", async () => {
        scriptQueue.add.mockResolvedValue({ id: "script-job" });

        const result = await service.requestScriptGeneration(
            "user-3",
            123,
            "custom prompt",
        );

        expect(scriptQueue.add).toHaveBeenCalledWith(
            "generateSummaryScript",
            expect.objectContaining({
                userId: "user-3",
                summaryId: 123,
                customPromptOverride: "custom prompt",
            }),
        );
        expect(result).toEqual({ jobId: "script-job" });
    });
});
