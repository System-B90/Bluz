// @vitest-environment jsdom

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GanttEventLabelCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttEventLabelCell";

/** The label cell of an event row under an expanded module. */

afterEach(cleanup);

function renderLabel(direction: "ltr" | "rtl") {
    render(
        <ThemeProvider theme={ createTheme({ direction, cssVariables: true }) }>
            <table>
                <tbody>
                    <tr>
                        <GanttEventLabelCell
                            eventId="e1"
                            eventTitle="הרצאת מבוא"
                            isRemoveOver={ false }
                            isUnmapped={ false }
                            minutes={ 60 }
                            moduleId="m1"
                            onTitleClick={ () => undefined }
                            setRemoveNodeRef={ () => undefined }
                            violations={ [] }
                        />
                    </tr>
                </tbody>
            </table>
        </ThemeProvider>,
    );
}

describe("GanttEventLabelCell connector (#849)", () => {
    it("hooks leftward into the row in RTL", () => {
        renderLabel("rtl");

        expect(screen.getByTestId("event-row-connector").textContent).toBe("↲");
    });

    it("keeps the rightward hook in LTR", () => {
        renderLabel("ltr");

        expect(screen.getByTestId("event-row-connector").textContent).toBe("↳");
    });

    it("hides the glyph from screen readers and keeps the title", () => {
        renderLabel("rtl");

        expect(screen.getByTestId("event-row-connector").getAttribute("aria-hidden")).toBe("true");
        expect(screen.getByText("הרצאת מבוא")).toBeTruthy();
    });
});
