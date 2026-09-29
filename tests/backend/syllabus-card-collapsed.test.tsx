// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The edit button must stay reachable when the syllabus card is collapsed.
 */

vi.mock("@/components/gantt/state/hooks/UseSyllabus", () => ({
    useSyllabus: () => ({ id: "s1", title: "סילבוס", modules: [], shuffles: [] }),
}));
vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumProviderActions: () => ({ openSyllabusDialog: vi.fn() }),
}));
vi.mock("@/components/base/CoursesProvider", () => ({
    useCourses: () => ({ getCourse: () => undefined }),
}));
vi.mock("@/components/base/HiveUsersProvider", () => ({
    useHiveUsers: () => ({ getInstructor: () => undefined }),
}));
vi.mock("@/components/gantt/curriculum-view/search/GanttSearchNavProvider", () => ({
    SYLLABUS_ANCHOR_PREFIX: "syllabus-",
    useGanttSearchNav: () => ({ highlightedSyllabusId: null }),
}));
vi.mock("@/components/gantt/syllabus-card/SyllabusCardHeader", () => ({
    SyllabusCardHeader: () => null,
}));
vi.mock("@/components/gantt/syllabus-card/ModulesTable", () => ({
    ModulesTable: () => <div data-testid="modules-table" />,
}));

import {
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { SyllabusCard } from "@/components/gantt/syllabus-card";

const props = {
    curriculumId: "c1" as GanttCurriculumId,
    syllabusId: "s1" as GanttSyllabusId,
};

afterEach(cleanup);

describe("SyllabusCard collapsed state", () => {
    it("shows the edit button and hides the modules when collapsed", () => {
        render(<SyllabusCard {...props} expanded={false} />);
        expect(screen.getByRole("button", { name: /עריכת סילבוס/ })).toBeTruthy();
        expect(screen.queryByTestId("modules-table")).toBeNull();
    });

    it("shows the edit button and the modules when expanded", () => {
        render(<SyllabusCard {...props} expanded />);
        expect(screen.getByRole("button", { name: /עריכת סילבוס/ })).toBeTruthy();
        expect(screen.getByTestId("modules-table")).toBeTruthy();
    });
});
