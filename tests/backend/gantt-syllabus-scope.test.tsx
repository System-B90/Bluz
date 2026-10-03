// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/base/CoursesProvider", () => ({
    useCourses: () => ({
        getCourse: (id: string) => ({ apollo: { name: "אפולו" }, sphinx: { name: "ספינקס" } })[ id ],
    }),
}));

import {
    shuffleCountLabel,
    SyllabusScopeSummary,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/SyllabusScopeSummary";

/**
 * Timeline syllabus rows (#830) now say which courses they serve and how
 * many shuffles split their students, so shuffle rules can be checked
 * where the planning happens.
 */

afterEach(cleanup);

describe("SyllabusScopeSummary (#830)", () => {
    it("names the syllabus' courses and counts its shuffles", () => {
        render(<SyllabusScopeSummary courseIds={ [ "apollo", "sphinx" ] as never } shuffles={ [ "ניצה", "לחם", "חול" ] } />);

        expect(screen.getByRole("img", { name: "מסלולים: אפולו, ספינקס" })).toBeTruthy();
        expect(screen.getByRole("img", { name: "שאפלים: ניצה, לחם, חול" }).textContent).toBe("3 שאפלים");
    });

    it("marks a course that no longer exists", () => {
        render(<SyllabusScopeSummary courseIds={ [ "gone" ] as never } />);

        expect(screen.getByRole("img", { name: "מסלולים: מסלול שנמחק" })).toBeTruthy();
    });

    it("renders nothing for a single-group syllabus with no courses", () => {
        render(<SyllabusScopeSummary courseIds={ [] } shuffles={ [] } />);

        expect(screen.queryByTestId("syllabus-scope")).toBeNull();
    });

    it("counts in Hebrew", () => {
        expect(shuffleCountLabel(1)).toBe("שאפל אחד");
        expect(shuffleCountLabel(2)).toBe("2 שאפלים");
    });
});
