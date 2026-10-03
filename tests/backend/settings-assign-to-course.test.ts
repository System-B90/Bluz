import { describe, expect, it } from "vitest";

import {
    assignToCourseLabel,
    toggleInstructor,
} from "@/components/settings-dialog/tabs/global/course-settings/AssignToCourseButton";

/** #848: instructors can be assigned to a course without dragging. */
describe("toggleInstructor", () => {
    it("adds an instructor the course doesn't have", () => {
        expect(toggleInstructor([ 1, 2 ], 3)).toEqual([ 1, 2, 3 ]);
    });

    it("removes an instructor the course already has", () => {
        expect(toggleInstructor([ 1, 2, 3 ], 2)).toEqual([ 1, 3 ]);
    });

    it("treats a course with no instructors as empty", () => {
        expect(toggleInstructor(undefined, 7)).toEqual([ 7 ]);
    });

    it("doesn't mutate the course's list", () => {
        const ids = [ 1 ];
        toggleInstructor(ids, 2);
        expect(ids).toEqual([ 1 ]);
    });
});

describe("assignToCourseLabel", () => {
    it("names the instructor in Hebrew", () => {
        expect(assignToCourseLabel({ display_name: "דנה" })).toBe("שיוך דנה למסלול…");
    });
});
