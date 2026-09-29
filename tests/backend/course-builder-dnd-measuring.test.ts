import { MeasuringFrequency, MeasuringStrategy } from "@dnd-kit/core";
import { describe, expect, it, vi } from "vitest";

/**
 * The course builder re-measures drop targets while dragging (#771). With the
 * default strategy the root drop zone's rect went stale once the layout
 * shifted mid-drag, and un-nesting a course silently did nothing.
 */

vi.mock("@/components/base/CoursesProvider", () => ({ useCourses: () => ({}) }));
vi.mock("@/components/base/HiveUsersProvider", () => ({ useHiveUsers: () => ({}) }));

import { COURSE_DND_MEASURING } from "@/components/settings-dialog/tabs/global/course-settings";

describe("course builder drag measuring (#771)", () => {
    it("re-measures droppables throughout the drag", () => {
        expect(COURSE_DND_MEASURING.droppable?.strategy).toBe(MeasuringStrategy.Always);
    });

    it("does not fall back to measuring only at drag start", () => {
        expect(COURSE_DND_MEASURING.droppable?.strategy).not.toBe(MeasuringStrategy.BeforeDragging);
        expect(COURSE_DND_MEASURING.droppable?.strategy).not.toBe(MeasuringStrategy.WhileDragging);
    });

    it("does not throttle re-measuring below the default", () => {
        const frequency = COURSE_DND_MEASURING.droppable?.frequency;
        expect(frequency === undefined || frequency === MeasuringFrequency.Optimized).toBe(true);
    });
});
