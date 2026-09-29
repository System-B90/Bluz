// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Syllabus cards wrap into rows and scroll down, not sideways (#759).
 */

const IDS = ["s1", "s2", "s3", "s4"];

vi.mock("@/components/gantt/state/hooks/UseCurriculum", () => ({
    useCurriculum: () => ({ syllabuses: IDS }),
}));
vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumState: () => ({ syllabuses: {} }),
}));
vi.mock("@/components/gantt/state/filters/Provider", () => ({
    useGanttFilters: () => ({
        clearFilters: vi.fn(),
        description: "",
        hasActiveFilters: false,
        syllabusMatches: () => true,
    }),
}));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ userData: null }) }));
vi.mock("@/components/gantt/curriculum-view/tabs/syllabuses-tab/orchestrated-first", () => ({
    orchestratedFirst: (ids: Array<string>) => ids,
}));
vi.mock("@/components/gantt/curriculum-view/tabs/UseProgressiveItemCount", () => ({
    useProgressiveItemCount: (n: number) => n,
}));
vi.mock("@/components/gantt/curriculum-view/components/syllabuses-actions-box", () => ({
    SyllabusesActionsBox: () => null,
}));
vi.mock("@/components/gantt/syllabus-card", () => ({
    SyllabusCard: ({ syllabusId }: { syllabusId: string }) => <div data-testid={`card-${syllabusId}`} />,
}));

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { SyllabusesTab } from "@/components/gantt/curriculum-view/tabs/syllabuses-tab";

afterEach(cleanup);

function container() {
    render(<SyllabusesTab curriculumId={"c1" as GanttCurriculumId} />);
    return getComputedStyle(screen.getByTestId("syllabus-cards"));
}

describe("SyllabusesTab layout (#759)", () => {
    it("lays cards out in rows", () => {
        expect(container().flexDirection).toBe("row");
    });

    it("wraps rows", () => {
        expect(container().flexWrap).toBe("wrap");
    });

    it("scrolls vertically", () => {
        expect(container().overflowY).toBe("auto");
    });

    it("never scrolls sideways", () => {
        expect(container().overflowX).toBe("hidden");
    });

    it("packs wrapped rows at the top", () => {
        expect(container().alignContent).toBe("flex-start");
    });

    it("keeps each card at its own height within a row", () => {
        expect(container().alignItems).toBe("flex-start");
    });

    it("renders every syllabus card inside the scroller", () => {
        render(<SyllabusesTab curriculumId={"c1" as GanttCurriculumId} />);
        const scroller = screen.getByTestId("syllabus-cards");
        for (const id of IDS) expect(scroller.contains(screen.getByTestId(`card-${id}`))).toBe(true);
    });

    it("keeps the cards in curriculum order", () => {
        render(<SyllabusesTab curriculumId={"c1" as GanttCurriculumId} />);
        const order = [...screen.getByTestId("syllabus-cards").querySelectorAll("[data-testid^=card-]")].map(
            (el) => el.getAttribute("data-testid"),
        );
        expect(order).toEqual(IDS.map((id) => `card-${id}`));
    });
});
