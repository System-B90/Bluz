// @vitest-environment jsdom

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumState: () => ({ syllabuses: { math: { title: "מתמטיקה" } } }),
}));

import { StudentLoadCard } from "@/components/gantt/curriculum-view/components/StudentLoadTooltip";

afterEach(cleanup);

const PATHS = [
    { id: "apollo", courseIds: [ "bis", "apollo" ], label: "אפולו" },
    { id: "sphinx", courseIds: [ "bis", "sphinx" ], label: "ספינקס" },
];

function renderCard(issues: Array<unknown>) {
    render(
        <ThemeProvider theme={ createTheme({ cssVariables: true }) }>
            <StudentLoadCard
                capacity={ 480 }
                load={ {
                    minutes: 420,
                    paths: [
                        { pathId: "apollo", minutes: 300, bySyllabus: [ { syllabusId: "math", minutes: 180 } ] },
                        { pathId: "sphinx", minutes: 420, bySyllabus: [ { syllabusId: "math", minutes: 180 } ] },
                    ],
                    issues: issues as never,
                } }
                paths={ PATHS }
                title="ראשון"
            />
        </ThemeProvider>,
    );
}

describe("StudentLoadCard issues", () => {
    it("gives a misaligned syllabus its own block with each shuffle's shortfall", () => {
        renderCard([ {
            kind: "shuffles-misaligned",
            syllabusId: "math",
            minutesByShuffle: { "מתחילים": 180, "מתקדמים": 150 },
        } ]);

        const block = screen.getByTestId("student-load-issue");
        expect(within(block).getByText("מתמטיקה")).toBeTruthy();
        expect(block.textContent).toContain("מתחילים");
        expect(block.textContent).toContain("(−0.5)");
    });

    it("lists every path's day when paths differ", () => {
        renderCard([ { kind: "paths-unequal" } ]);

        const block = screen.getByTestId("student-load-issue");
        expect(block.textContent).toContain("אפולו");
        expect(block.textContent).toContain("(−2)");
    });
});
