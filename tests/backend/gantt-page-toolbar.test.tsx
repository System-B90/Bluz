// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Gantt page toolbar: hour format toggle inline when wide, behind a burger
 * menu when narrow.
 */

const { media } = vi.hoisted(() => ({ media: { narrow: false } }));
vi.mock("@mui/material/useMediaQuery", () => ({ default: () => media.narrow }));

import { getHoursFormat, setHoursFormat } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { GanttPageToolbar } from "@/components/gantt/curriculum-view/tabs/GanttPageToolbar";

afterEach(() => {
    cleanup();
    setHoursFormat("decimal");
});

describe("GanttPageToolbar", () => {
    it("switches the hour format inline when wide", () => {
        media.narrow = false;
        render(<GanttPageToolbar gridTools />);
        expect(screen.queryByRole("button", { name: "סרגל כלים" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "0:45" }));
        expect(getHoursFormat()).toBe("clock");
    });

    it("folds into a burger menu when narrow", () => {
        media.narrow = true;
        render(<GanttPageToolbar gridTools />);
        expect(screen.queryByRole("button", { name: "0:45" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "סרגל כלים" }));
        fireEvent.click(screen.getByRole("button", { name: "0:45" }));
        expect(getHoursFormat()).toBe("clock");
    });

    it("shows the table-only controls on the table tab", () => {
        media.narrow = false;
        render(<GanttPageToolbar gridTools />);
        expect(screen.getByRole("button", { name: "קווים אנכיים בטבלה" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "התעלמות מהפסקות בסכומי הזמן בטבלה" })).toBeTruthy();
    });

    it("hides the table-only controls on other tabs but keeps the hour format", () => {
        media.narrow = false;
        render(<GanttPageToolbar gridTools={ false } />);
        for (const name of [ "קווים אנכיים בטבלה", "התעלמות מהפסקות בסכומי הזמן בטבלה", "אנימציית פתיחה וסגירה בטבלה" ]) {
            expect(screen.queryByRole("button", { name })).toBeNull();
        }
        expect(screen.queryByRole("button", { name: /כל השורות/ })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "0:45" }));
        expect(getHoursFormat()).toBe("clock");
    });
});
