import { describe, it, expect } from "vitest";

import { safeTitle } from "@/api-shared/common";

describe("safeTitle", () => {
    it("keeps ASCII alphanumerics", () => {
        expect(safeTitle("Curriculum 2026")).toBe("Curriculum_2026");
    });

    it("preserves Hebrew characters", () => {
        expect(safeTitle("תוכנית לימודים")).toBe("תוכנית_לימודים");
    });

    it("collapses punctuation and symbols to underscores", () => {
        expect(safeTitle("a/b\\c:d*e?")).toBe("a_b_c_d_e_");
    });

    it("returns an all-underscore token for fully unsafe input", () => {
        expect(safeTitle("!@#$")).toBe("____");
    });
});
