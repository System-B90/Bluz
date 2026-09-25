import { describe, expect, it } from "vitest";

import { buildGanttEventLink } from "@/components/schedule/event-dialog/utils";

// Regression for the "go to gantt event" link silently failing: `ge` alone
// isn't enough — the gantt page needs `gc` to load a curriculum, and drops
// to the wrong/no iteration without `it`.
describe("buildGanttEventLink", () => {
    it("sets ge, gc and it together", () => {
        const link = buildGanttEventLink(
            { ganttEventId: "evt-1", ganttCurriculumId: "curr-1" },
            "2026a",
        );
        const url = new URL(link!, "http://localhost");
        expect(url.pathname).toBe("/gantt");
        expect(url.searchParams.get("ge")).toBe("evt-1");
        expect(url.searchParams.get("gc")).toBe("curr-1");
        expect(url.searchParams.get("it")).toBe("2026a");
    });

    it("omits it when no iteration is in scope", () => {
        const link = buildGanttEventLink({
            ganttEventId: "evt-1",
            ganttCurriculumId: "curr-1",
        });
        const url = new URL(link!, "http://localhost");
        expect(url.searchParams.has("it")).toBe(false);
    });

    it("returns undefined without a gantt curriculum id (event never cut, or cut before the field existed)", () => {
        expect(
            buildGanttEventLink({ ganttEventId: "evt-1" }, "2026a"),
        ).toBeUndefined();
    });

    it("returns undefined for a normal (non-cut) event", () => {
        expect(buildGanttEventLink({}, "2026a")).toBeUndefined();
    });
});
