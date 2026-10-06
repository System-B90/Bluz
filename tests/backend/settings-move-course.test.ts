import type { Active, Over } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { Course } from "@/api-shared/types/course";
import { CourseUser } from "@/api-shared/types/hive";
import { courseDndAccessibility } from "@/components/settings-dialog/tabs/global/course-settings/course-dnd-announcements";
import {
    movedCourseMessage,
    moveTargets,
    wouldNestInsideItself,
} from "@/components/settings-dialog/tabs/global/course-settings/course-moves";

/** #885: courses move in the hierarchy without dragging. */

const course = (id: string, name: string, parentId: null | string = null): Course =>
    ({ id, name, parentId, color: null, instructorIds: [] }) as unknown as Course;

// root ─┬─ a ── a1 ── a2
//       └─ b
// c
const tree = [
    course("root", "בסיס"),
    course("a", "אפולו", "root"),
    course("a1", "אפולו-1", "a"),
    course("a2", "אפולו-2", "a1"),
    course("b", "מבצר", "root"),
    course("c", "ספינקס"),
];

describe("wouldNestInsideItself", () => {
    it("is true for the course itself and every descendant", () => {
        for (const target of [ "a", "a1", "a2" ]) {
            expect(wouldNestInsideItself(tree, "a", target)).toBe(true);
        }
    });

    it("is false for ancestors, siblings and other trees", () => {
        for (const target of [ "root", "b", "c" ]) {
            expect(wouldNestInsideItself(tree, "a", target)).toBe(false);
        }
    });

    it("terminates on a cycle in the data", () => {
        const looped = [ course("x", "x", "y"), course("y", "y", "x") ];
        expect(wouldNestInsideItself(looped, "z", "x")).toBe(false);
    });
});

describe("moveTargets", () => {
    const ids = (c: Course) => moveTargets(tree, c).map((o) => o.course.id);

    it("leaves out the course, its descendants and its current parent", () => {
        expect(ids(tree[ 1 ]).sort()).toEqual([ "b", "c" ]);
    });

    it("offers every other course to a top-level course", () => {
        expect(ids(tree[ 5 ]).sort()).toEqual([ "a", "a1", "a2", "b", "root" ]);
    });

    it("keeps tree depth for indentation", () => {
        const depths = Object.fromEntries(moveTargets(tree, tree[ 5 ]).map((o) => [ o.course.id, o.depth ]));
        expect(depths).toMatchObject({ root: 0, a: 1, a1: 2, b: 1 });
    });
});

describe("movedCourseMessage", () => {
    it("names the new parent, or the top level", () => {
        expect(movedCourseMessage(tree[ 1 ], tree[ 4 ])).toBe("אפולו הועבר אל מבצר");
        expect(movedCourseMessage(tree[ 1 ], null)).toBe("אפולו הועבר לרמה העליונה");
    });
});

describe("courseDndAccessibility", () => {
    const instructors = [ { id: 7, display_name: "דנה" } ] as unknown as Array<CourseUser>;
    const { announcements, screenReaderInstructions } = courseDndAccessibility(tree, instructors);
    const active = (data: object) => ({ data: { current: data } }) as unknown as Active;
    const over = (data: object) => ({ data: { current: data } }) as unknown as Over;

    it("names dragged courses and instructors in Hebrew", () => {
        expect(announcements.onDragStart({ active: active({ type: "COURSE", courseId: "a" }) })).toBe("אפולו הורם.");
        expect(announcements.onDragStart({ active: active({ type: "INSTRUCTOR", instructorId: 7 }) })).toBe("דנה הורם.");
    });

    it("names the drop target, including the root zone", () => {
        const a = active({ type: "COURSE", courseId: "a" });
        expect(announcements.onDragOver({ active: a, over: over({ type: "COURSE_DROP", targetCourseId: "c" }) }))
            .toBe("אפולו מעל ספינקס.");
        expect(announcements.onDragEnd({ active: a, over: over({ type: "ROOT_DROP" }) }))
            .toBe("אפולו שוחרר אל הרמה העליונה.");
        expect(announcements.onDragEnd({ active: a, over: null })).toContain("לא בוצע שינוי");
    });

    it("points keyboard users at the move button", () => {
        expect(screenReaderInstructions.draggable).toContain("כפתור ההעברה");
    });
});
