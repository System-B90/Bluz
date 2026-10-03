// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SKELETON_DAYS, SKELETON_WEEKS, WeeksTableSkeleton } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeeksTableSkeleton";

/** The weeks tab loads behind a table-shaped skeleton, not a lone spinner (#839). */

afterEach(cleanup);

describe("WeeksTableSkeleton", () => {
    it("draws 13 weeks × 7 days", () => {
        render(<WeeksTableSkeleton />);
        expect(screen.getAllByTestId("weeks-skeleton-day")).toHaveLength(SKELETON_WEEKS * SKELETON_DAYS);
        expect(SKELETON_WEEKS * SKELETON_DAYS).toBe(91);
    });

    it("is announced as busy and has no spinner", () => {
        render(<WeeksTableSkeleton />);
        const busy = screen.getByRole("progressbar", { name: "טוען את טבלת השבועות" });
        expect(busy.getAttribute("aria-busy")).toBe("true");
        expect(document.querySelector(".MuiCircularProgress-root")).toBeNull();
    });
});
