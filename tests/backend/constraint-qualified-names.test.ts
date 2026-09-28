import { describe, expect, it } from "vitest";

import {
    ConstraintDisplayState,
    qualifiedEntityName,
} from "@/api-shared/types/gantt/models/constraint";
import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models/shared";

/** Constraint endpoints read as "syllabus › module › event", not a bare title. */

const state = {
    syllabuses: { s1: { title: "פיקוד" } },
    modules: { m1: { title: "מבוא", syllabusId: "s1" }, m2: { title: "יתום", syllabusId: "gone" } },
    events: { e1: { title: "הרצאה", moduleId: "m1" } },
} as unknown as ConstraintDisplayState;

describe("qualifiedEntityName", () => {
    it("qualifies an event with its syllabus and module", () => {
        expect(qualifiedEntityName("event", "e1" as GanttEventId, state)).toBe("פיקוד › מבוא › הרצאה");
    });

    it("qualifies a module with its syllabus", () => {
        expect(qualifiedEntityName("module", "m1" as GanttModuleId, state)).toBe("פיקוד › מבוא");
    });

    it("drops a missing ancestor", () => {
        expect(qualifiedEntityName("module", "m2" as GanttModuleId, state)).toBe("יתום");
    });

    it("marks a missing entity as not found", () => {
        expect(qualifiedEntityName("event", "nope" as GanttEventId, state)).toBe("*לא נמצא*");
        expect(qualifiedEntityName("module", "nope" as GanttModuleId, state)).toBe("*לא נמצא*");
    });
});
