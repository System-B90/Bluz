// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The history panel inside the event dialog: lazy loading, the states it can
 * be in, and that a change is rendered with resolved names rather than raw ids.
 */

const { apiGetEventHistory } = vi.hoisted(() => ({
    apiGetEventHistory: vi.fn(),
}));

vi.mock("@/api-client/calendar", () => ({ apiGetEventHistory }));
vi.mock("@/components/base/CoursesProvider", () => ({
    useCourses: () => ({ courses: [{ id: "c1", name: "מסלול א" }] }),
}));
vi.mock("@/components/base/HiveUsersProvider", () => ({
    useHiveUsers: () => ({
        getInstructor: (id: number) =>
            id === 7 ? { display_name: "מיכאל" } : undefined,
    }),
}));
vi.mock("@/components/base/RoomsProvider", () => ({
    useRooms: () => ({ rooms: [{ id: "r1", name: "כיתה 1" }] }),
}));
vi.mock("@/components/base/CustomColorsProvider", () => ({
    useCustomColors: () => ({ getCustomColor: () => undefined }),
}));
vi.mock("@/components/base/HiveSubjectsProvider", () => ({
    useHiveSubjects: () => ({ getSubject: () => undefined }),
}));
vi.mock("@/components/schedule/calendar/calendar-provider/CalendarContext", () => ({
    useCalendar: () => ({ iterationId: undefined }),
}));

import {
    EventChangeAction,
    EventChangeInitiator,
} from "@/api-shared/types/event-history";
import { EventHistoryPanel } from "@/components/schedule/event-dialog/event-history";

const updateRow = {
    action: EventChangeAction.Updated,
    actorHiveId: 7,
    actorId: "7",
    actorName: "מיכאל",
    changedAt: new Date().toISOString(),
    changes: [
        {
            field: "startTime",
            from: new Date("2024-01-07T08:00:00").getTime(),
            to: new Date("2024-01-07T10:00:00").getTime(),
        },
        { field: "instructors", from: [], to: [7] },
    ],
    eventId: "e1",
    id: "row-1",
    initiator: EventChangeInitiator.DragDrop,
};

const cutRow = {
    action: EventChangeAction.Created,
    actorHiveId: null,
    actorId: null,
    actorName: null,
    changedAt: new Date().toISOString(),
    changes: [],
    eventId: "e1",
    id: "row-0",
    initiator: EventChangeInitiator.GanttCut,
};

async function expand(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /היסטוריית שינויים/ }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("EventHistoryPanel", () => {
    it("fetches nothing until the panel is expanded", () => {
        apiGetEventHistory.mockResolvedValue([]);
        render(<EventHistoryPanel eventId="e1" />);

        expect(apiGetEventHistory).not.toHaveBeenCalled();
    });

    it("loads the log on expand, scoped to the viewed iteration", async () => {
        const user = userEvent.setup();
        apiGetEventHistory.mockResolvedValue([updateRow]);

        render(<EventHistoryPanel eventId="e1" />);
        await expand(user);

        await waitFor(() =>
            expect(apiGetEventHistory).toHaveBeenCalledWith("e1", undefined),
        );
    });

    it("renders a change with resolved names and readable times", async () => {
        const user = userEvent.setup();
        apiGetEventHistory.mockResolvedValue([updateRow]);

        render(<EventHistoryPanel eventId="e1" />);
        await expand(user);

        // Who did it, and how.
        expect(await screen.findByText("גרירה בלוח")).toBeTruthy();
        // The actor line, plus the resolved instructor inside the diff.
        expect(screen.getAllByText("מיכאל")).toHaveLength(2);
        // What changed: labelled fields, formatted values, resolved ids.
        expect(screen.getByText("שעת התחלה")).toBeTruthy();
        // Both sides land on the same day, so the row omits the date.
        expect(screen.getByText("08:00")).toBeTruthy();
        expect(screen.getByText("10:00")).toBeTruthy();
        expect(screen.getByText("מדריכים")).toBeTruthy();
    });

    it("attributes a gantt write to the system, with no field diff", async () => {
        const user = userEvent.setup();
        apiGetEventHistory.mockResolvedValue([cutRow]);

        render(<EventHistoryPanel eventId="e1" />);
        await expand(user);

        expect(await screen.findByText('גזירה ללו"ז')).toBeTruthy();
        expect(screen.getByText("מערכת")).toBeTruthy();
        expect(screen.getByText("נוצר")).toBeTruthy();
    });

    it("shows an empty state when nothing was ever recorded", async () => {
        const user = userEvent.setup();
        apiGetEventHistory.mockResolvedValue([]);

        render(<EventHistoryPanel eventId="e1" />);
        await expand(user);

        expect(await screen.findByText("לא נרשמו שינויים למופע זה.")).toBeTruthy();
    });

    it("surfaces a failure with a retry that refetches", async () => {
        const user = userEvent.setup();
        apiGetEventHistory.mockRejectedValueOnce(new Error("boom"));

        render(<EventHistoryPanel eventId="e1" />);
        await expand(user);

        expect(
            await screen.findByText("טעינת היסטוריית השינויים נכשלה."),
        ).toBeTruthy();

        apiGetEventHistory.mockResolvedValueOnce([updateRow]);
        await user.click(screen.getByRole("button", { name: "נסו שוב" }));

        expect(await screen.findByText("גרירה בלוח")).toBeTruthy();
    });

    it("does not show one event's log for another", async () => {
        const user = userEvent.setup();
        apiGetEventHistory.mockResolvedValue([updateRow]);

        const { rerender } = render(<EventHistoryPanel eventId="e1" />);
        await expand(user);
        expect(await screen.findByText("גרירה בלוח")).toBeTruthy();

        // The dialog is reused for a different event.
        rerender(<EventHistoryPanel eventId="e2" />);

        expect(screen.queryByText("גרירה בלוח")).toBeNull();
        // Collapsed again, so nothing is fetched for the new event either.
        expect(apiGetEventHistory).toHaveBeenCalledTimes(1);
    });
});
