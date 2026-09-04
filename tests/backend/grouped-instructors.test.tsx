// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { courses, instructors } = vi.hoisted(() => ({
    courses: { value: [] as Array<unknown> },
    instructors: { value: [] as Array<unknown> },
}));

vi.mock("@/components/base/CoursesProvider", () => ({
    useCourses: () => ({ courses: courses.value }),
}));
vi.mock("@/components/base/HiveUsersProvider", () => ({
    useHiveUsers: () => ({
        instructors: instructors.value,
        getInstructor: (id: number) =>
            (instructors.value as Array<{ id: number }>).find(
                (user) => user.id === id,
            ),
    }),
}));

import { useGroupedInstructors } from "@/components/base/use-grouped-instructors";

/**
 * Instructor grouping shared by the select boxes and the schedule rail. The
 * ordering is Hebrew-collated and parent-before-child, and an instructor no
 * course claims must still be offered — dropping them silently hides real
 * people from the picker.
 */
const USERS = [
    { id: 1, display_name: "בני", teacher: false },
    { id: 2, display_name: "אבי", teacher: true },
    { id: 3, display_name: "גדי", teacher: false },
    { id: 4, display_name: "דנה", teacher: false },
];

function seed() {
    instructors.value = USERS;
    courses.value = [
        { id: "c2", name: "בסיסי", instructorIds: [ 3 ] },
        { id: "c1", name: "אודות", instructorIds: [ 1, 2 ] },
        { id: "c1a", name: "תת-מסלול", parentId: "c1", instructorIds: [ 1 ] },
        { id: "c3", name: "ריק", instructorIds: [] },
    ];
}

const render = (options = {}) => {
    seed();
    return renderHook(() => useGroupedInstructors(options)).result;
};

afterEach(cleanup);

describe("useGroupedInstructors", () => {
    it("orders root courses in Hebrew and puts a child right after its parent", () => {
        const { courseGroups } = render().current;

        expect(courseGroups.map((g) => g.course.id)).toEqual([
            "c1",
            "c1a",
            "c2",
        ]);
    });

    it("drops a course nobody teaches", () => {
        const { courseGroups } = render().current;

        expect(courseGroups.map((g) => g.course.id)).not.toContain("c3");
    });

    it("sorts instructors inside a group in Hebrew", () => {
        const { courseGroups } = render().current;

        expect(
            courseGroups[ 0 ].instructors.map((i) => i.display_name),
        ).toEqual([ "אבי", "בני" ]);
    });

    it("lists an instructor no course claims under the unassigned remainder", () => {
        const { unassigned } = render().current;

        expect(unassigned.map((i) => i.display_name)).toEqual([ "דנה" ]);
    });

    it("filters both groups by the search query, case-insensitively", () => {
        const { courseGroups, unassigned } = render({
            searchQuery: "  דנ ",
        }).current;

        expect(courseGroups).toEqual([]);
        expect(unassigned.map((i) => i.display_name)).toEqual([ "דנה" ]);
    });

    it("excludes teachers when asked, keeping the rest of the group", () => {
        const { courseGroups } = render({ excludeTeachers: true }).current;

        const first = courseGroups.find((g) => g.course.id === "c1")!;
        expect(first.instructors.map((i) => i.display_name)).toEqual([ "בני" ]);
    });

    it("returns empty groups when nothing matches", () => {
        const result = render({ searchQuery: "אין כזה" }).current;

        expect(result.courseGroups).toEqual([]);
        expect(result.unassigned).toEqual([]);
    });

    it("ignores an instructor id no user resolves to", () => {
        seed();
        courses.value = [ { id: "c9", name: "מסלול", instructorIds: [ 99 ] } ];

        const { courseGroups } = renderHook(() => useGroupedInstructors())
            .result.current;

        expect(courseGroups).toEqual([]);
    });
});
