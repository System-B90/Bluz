// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Switching back to the current run has to clear the iteration scope, not pin
 * the current run's own id: the rest of the calendar reads `undefined` as
 * "current run", and current-run broadcasts carry no iterationId.
 */

const { setIterationId } = vi.hoisted(() => ({ setIterationId: vi.fn() }));
const calendarState = { iterationId: undefined as string | undefined };

vi.mock("@/components/schedule/calendar/calendar-provider/CalendarContext", () => ({
    useCalendar: () => ({
        isReadOnlyIteration: calendarState.iterationId !== undefined,
        iterationId: calendarState.iterationId,
        setIterationId,
    }),
}));
vi.mock("@/components/base/IterationProvider", () => ({
    useIterationScope: () => ({
        currentIterationId: "it-now",
        iterations: [
            { id: "it-now", isCurrent: true, label: "מחזור נוכחי" },
            { id: "it-past", isCurrent: false, label: "מחזור קודם" },
        ],
    }),
}));

import { IterationSelector } from "@/components/schedule/calendar/calendar/IterationSelector";

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    calendarState.iterationId = undefined;
});

function pickIteration(label: string) {
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: new RegExp(label) }));
}

describe("IterationSelector (#609)", () => {
    it("clears the scope when the current run is picked, keeping live updates on", () => {
        calendarState.iterationId = "it-past";
        render(<IterationSelector />);

        pickIteration("מחזור נוכחי");

        // A concrete id here filtered out every current-run broadcast, which
        // carries no iterationId — the calendar went stale until a reload.
        expect(setIterationId).toHaveBeenCalledWith(undefined);
    });

    it("scopes to a past iteration by its id", () => {
        render(<IterationSelector />);

        pickIteration("מחזור קודם");

        expect(setIterationId).toHaveBeenCalledWith("it-past");
    });
});
