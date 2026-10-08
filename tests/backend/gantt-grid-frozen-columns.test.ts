import { describe, expect, it } from "vitest";

import { frozenColumns } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/frozen-columns";

/** #913: the gantt table's leading columns stay put while the weeks scroll sideways. */
describe("frozenColumns", () => {
    const widths = { courseWidth: 48, leadColumns: 3, hoursWidth: 64 };

    it("stacks the courses, then the measured title, then the hour columns", () => {
        expect(frozenColumns({ ...widths, courseCount: 2, titleWidth: 300 })).toEqual({
            offsets: [ 0, 48, 96, 396, 460 ],
            width: 524,
        });
    });

    it("starts at the title when there are no course columns", () => {
        expect(frozenColumns({ ...widths, courseCount: 0, titleWidth: 220 })).toEqual({
            offsets: [ 0, 220, 284 ],
            width: 348,
        });
    });
});
