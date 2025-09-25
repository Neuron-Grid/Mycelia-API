import { describe, expect, it } from "@jest/globals";
import { normalizeTagPath } from "@/tag/domain/tag-path.util";

describe("normalizeTagPath", () => {
    it("splits dot-delimited ltree strings into path segments", () => {
        expect(
            normalizeTagPath("technology.programming.javascript"),
        ).toStrictEqual(["technology", "programming", "javascript"]);
    });

    it("returns the same array when input is already an array", () => {
        expect(normalizeTagPath(["root", "child"])).toStrictEqual([
            "root",
            "child",
        ]);
    });

    it("filters empty segments and handles nullish values", () => {
        expect(normalizeTagPath("analytics..reports")).toStrictEqual([
            "analytics",
            "reports",
        ]);
        expect(normalizeTagPath(null)).toStrictEqual([]);
    });
});
