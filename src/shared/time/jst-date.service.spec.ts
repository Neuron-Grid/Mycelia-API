import { describe, expect, it } from "@jest/globals";
import { JstDateService } from "@/shared/time/jst-date.service";

describe("JstDateService.getWeekday", () => {
    const service = new JstDateService();

    it("returns 0 for Sunday in JST regardless of host timezone", () => {
        const date = new Date("2024-05-11T18:00:00.000Z");
        expect(service.getWeekday(date)).toBe(0);
    });

    it("returns 1 for Monday in JST regardless of host timezone", () => {
        const date = new Date("2024-05-12T18:00:00.000Z");
        expect(service.getWeekday(date)).toBe(1);
    });
});
