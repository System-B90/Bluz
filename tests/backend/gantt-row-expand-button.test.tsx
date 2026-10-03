// @vitest-environment jsdom

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RowExpandButton } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/RowExpandButton";

/**
 * The timeline row toggle (#816) used to be a bare "▶" span: no Tab stop, no
 * name, no state, and pointing back at the label in RTL.
 */

afterEach(cleanup);

function renderButton(expanded: boolean, direction: "ltr" | "rtl" = "rtl") {
    const onToggle = vi.fn();
    const onRowClick = vi.fn();
    render(
        <ThemeProvider theme={ createTheme({ direction }) }>
            <div onClick={ onRowClick }>
                <RowExpandButton expanded={ expanded } name="קפ״ה שבוע 1" onToggle={ onToggle } />
            </div>
        </ThemeProvider>,
    );
    return { onToggle, onRowClick };
}

describe("RowExpandButton (#816)", () => {
    it("is a named button that reports its collapsed state", () => {
        renderButton(false);

        const button = screen.getByRole("button", { name: "הרחבת קפ״ה שבוע 1" });
        expect(button.getAttribute("aria-expanded")).toBe("false");
    });

    it("renames itself and reports expanded once open", () => {
        renderButton(true);

        const button = screen.getByRole("button", { name: "כיווץ קפ״ה שבוע 1" });
        expect(button.getAttribute("aria-expanded")).toBe("true");
        expect(screen.getByTestId("ExpandMoreIcon")).toBeTruthy();
    });

    it("points left when collapsed in RTL, right in LTR", () => {
        renderButton(false, "rtl");
        expect(screen.getByTestId("ChevronLeftIcon")).toBeTruthy();
        cleanup();

        renderButton(false, "ltr");
        expect(screen.getByTestId("ChevronRightIcon")).toBeTruthy();
    });

    it("toggles once, without also firing the row's own click", () => {
        const { onToggle, onRowClick } = renderButton(false);

        fireEvent.click(screen.getByRole("button"));

        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(onRowClick).not.toHaveBeenCalled();
    });
});
