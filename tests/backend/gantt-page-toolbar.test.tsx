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
        render(<GanttPageToolbar />);
        expect(screen.queryByRole("button", { name: "סרגל כלים" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "0:45" }));
        expect(getHoursFormat()).toBe("clock");
    });

    it("folds into a burger menu when narrow", () => {
        media.narrow = true;
        render(<GanttPageToolbar />);
        expect(screen.queryByRole("button", { name: "0:45" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "סרגל כלים" }));
        fireEvent.click(screen.getByRole("button", { name: "0:45" }));
        expect(getHoursFormat()).toBe("clock");
    });
});
