// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("notistack", () => ({ enqueueSnackbar: vi.fn() }));
vi.mock("@/components/base/CalendarFilterProvider", () => ({
    useCalendarFilters: () => ({
        filteredInstructors: [ 7 ],
        filteredCourses: [ "c1" ],
    }),
}));

import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { useCalendarHandlers } from "@/components/schedule/calendar/calendar/UseCalendarHandlers";
import { Event } from "@/components/schedule/types/event";

/**
 * The calendar's mouse and keyboard gestures: drag, Ctrl+drag duplicate
 * (#575), resize, slot select, and the copy/cut/paste/delete shortcuts. Every
 * one of these writes an event, so the interesting cases are the ones that
 * must *not* write: a locked event, a typing target, an open dialog.
 */
const baseEvent = {
    id: "e1",
    title: "מופע",
    rooms: [],
    startTime: dayjs("2026-03-01T08:00:00.000Z"),
    endTime: dayjs("2026-03-01T09:00:00.000Z"),
    ganttEventId: "ge1",
    ganttCurriculumId: "c1",
    locked: false,
} as unknown as Event;

function renderHandlers() {
    const handleSaveEvent = vi.fn();
    const handleDeleteEvent = vi.fn();
    const setSelectedEvent = vi.fn();
    const setOpenEventDialog = vi.fn();
    const result = renderHook(() =>
        useCalendarHandlers(
            [ baseEvent ],
            handleSaveEvent,
            handleDeleteEvent,
            setSelectedEvent,
            setOpenEventDialog,
        ),
    ).result;
    return {
        result,
        handleSaveEvent,
        handleDeleteEvent,
        setSelectedEvent,
        setOpenEventDialog,
    };
}

const dropAt = (start: string, end: string, resourceId?: string) =>
    ({
        event: baseEvent,
        start: new Date(start),
        end: new Date(end),
        resourceId,
    }) as never;

/** Dispatched from the body so the handler sees a real element as its target. */
function press(key: string, init: KeyboardEventInit = {}) {
    act(() => {
        document.body.dispatchEvent(
            new KeyboardEvent("keydown", { key, bubbles: true, ...init }),
        );
    });
}

beforeEach(() => {
    document.body.innerHTML = "";
});
afterEach(cleanup);

describe("useCalendarHandlers — drag and resize", () => {
    it("moves an event to the dropped times", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() =>
            result.current.handleEventDrag(
                dropAt("2026-03-02T10:00:00.000Z", "2026-03-02T11:00:00.000Z"),
            ),
        );

        const [ saved, initiator ] = handleSaveEvent.mock.calls[ 0 ];
        expect(saved.id).toBe("e1");
        expect(saved.startTime.toISOString()).toBe(
            "2026-03-02T10:00:00.000Z",
        );
        expect(initiator).toBe(EventChangeInitiator.DragDrop);
    });

    it("reports a resize as a resize, not a move", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() =>
            result.current.handleEventDrag(
                dropAt("2026-03-01T08:00:00.000Z", "2026-03-01T10:00:00.000Z"),
                "resize",
            ),
        );

        expect(handleSaveEvent.mock.calls[ 0 ][ 1 ]).toBe(
            EventChangeInitiator.Resize,
        );
    });

    it("refuses to move a locked event", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() =>
            result.current.handleEventDrag({
                ...dropAt(
                    "2026-03-02T10:00:00.000Z",
                    "2026-03-02T11:00:00.000Z",
                ),
                event: { ...baseEvent, locked: true },
            } as never),
        );

        expect(handleSaveEvent).not.toHaveBeenCalled();
    });

    it("clears the room when dropped on the unassigned column", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() =>
            result.current.handleEventDrag(
                dropAt(
                    "2026-03-02T10:00:00.000Z",
                    "2026-03-02T11:00:00.000Z",
                    "Custom:no-room-unassigned",
                ),
            ),
        );

        expect(handleSaveEvent.mock.calls[ 0 ][ 0 ].rooms).toEqual([]);
    });

    it("a duplicate drop saves a brand-new event and leaves the original alone", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() =>
            result.current.handleEventDrag(
                dropAt("2026-03-02T10:00:00.000Z", "2026-03-02T11:00:00.000Z"),
                "duplicate",
            ),
        );

        expect(handleSaveEvent).toHaveBeenCalledTimes(1);
        const [ saved, initiator ] = handleSaveEvent.mock.calls[ 0 ];
        expect(saved.id).toBeUndefined();
        // Gantt provenance must not follow the copy (#575).
        expect(saved.ganttEventId).toBeUndefined();
        expect(saved.ganttCurriculumId).toBeUndefined();
        expect(saved.title).toBe("מופע");
        expect(saved.startTime.toISOString()).toBe(
            "2026-03-02T10:00:00.000Z",
        );
        expect(initiator).toBe(EventChangeInitiator.DragDrop);
    });

    it("refuses to duplicate a locked event", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() =>
            result.current.handleEventDrag(
                {
                    ...dropAt(
                        "2026-03-02T10:00:00.000Z",
                        "2026-03-02T11:00:00.000Z",
                    ),
                    event: { ...baseEvent, locked: true },
                } as never,
                "duplicate",
            ),
        );

        expect(handleSaveEvent).not.toHaveBeenCalled();
    });
});

describe("useCalendarHandlers — split (#657)", () => {
    const at = (iso: string) => new Date(iso).getTime();

    it("trims the original to the cut and creates the tail as a new event", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() =>
            result.current.handleSplitEvent(
                baseEvent,
                at("2026-03-01T08:20:00.000Z"),
            ),
        );

        expect(handleSaveEvent).toHaveBeenCalledTimes(2);
        const [ head, headInitiator ] = handleSaveEvent.mock.calls[ 0 ];
        const [ tail, tailInitiator ] = handleSaveEvent.mock.calls[ 1 ];

        expect(head.id).toBe("e1");
        expect(head.startTime.toISOString()).toBe("2026-03-01T08:00:00.000Z");
        expect(head.endTime.toISOString()).toBe("2026-03-01T08:20:00.000Z");
        expect(head.ganttEventId).toBe("ge1");

        expect(tail.id).toBeUndefined();
        expect(tail.ganttEventId).toBeUndefined();
        expect(tail.title).toBe("מופע");
        expect(tail.startTime.toISOString()).toBe("2026-03-01T08:20:00.000Z");
        expect(tail.endTime.toISOString()).toBe("2026-03-01T09:00:00.000Z");

        expect(headInitiator).toBe(EventChangeInitiator.Split);
        expect(tailInitiator).toBe(EventChangeInitiator.Split);
    });

    it("refuses a cut that would leave a piece shorter than the grid step", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() =>
            result.current.handleSplitEvent(
                baseEvent,
                at("2026-03-01T08:02:00.000Z"),
            ),
        );
        act(() =>
            result.current.handleSplitEvent(
                baseEvent,
                at("2026-03-01T09:00:00.000Z"),
            ),
        );

        expect(handleSaveEvent).not.toHaveBeenCalled();
    });

    it("refuses to split a locked event", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() =>
            result.current.handleSplitEvent(
                { ...baseEvent, locked: true },
                at("2026-03-01T08:30:00.000Z"),
            ),
        );

        expect(handleSaveEvent).not.toHaveBeenCalled();
    });
});

describe("useCalendarHandlers — slot selection", () => {
    it("opens a new event seeded from the slot and the active filters", () => {
        const { result, setSelectedEvent, setOpenEventDialog } =
            renderHandlers();

        act(() =>
            result.current.handleSlotSelect({
                action: "select",
                start: new Date("2026-03-02T10:00:00.000Z"),
                end: new Date("2026-03-02T11:00:00.000Z"),
                resourceId: "Custom:r1",
                slots: [],
            } as never),
        );

        const [ seeded ] = setSelectedEvent.mock.calls[ 0 ];
        expect(seeded.instructors).toEqual([ 7 ]);
        expect(seeded.courses).toEqual([ "c1" ]);
        expect(seeded.rooms).toHaveLength(1);
        expect(setOpenEventDialog).toHaveBeenCalledWith(true);
    });

    it("a plain click only remembers the slot, without opening the dialog", () => {
        const { result, setSelectedEvent, setOpenEventDialog } =
            renderHandlers();

        act(() =>
            result.current.handleSlotSelect({
                action: "click",
                start: new Date("2026-03-02T10:00:00.000Z"),
                end: new Date("2026-03-02T10:30:00.000Z"),
                slots: [],
            } as never),
        );

        expect(setSelectedEvent).not.toHaveBeenCalled();
        expect(setOpenEventDialog).not.toHaveBeenCalled();
    });
});

describe("useCalendarHandlers — keyboard", () => {
    it("Delete removes the active event", () => {
        const { result, handleDeleteEvent } = renderHandlers();

        act(() => result.current.setActiveEvent(baseEvent));
        press("Delete");

        expect(handleDeleteEvent).toHaveBeenCalledWith(
            "e1",
            EventChangeInitiator.Keyboard,
        );
    });

    it("Delete does nothing with no active event", () => {
        const { handleDeleteEvent } = renderHandlers();

        press("Delete");

        expect(handleDeleteEvent).not.toHaveBeenCalled();
    });

    it("Ctrl+X copies and removes, clearing the selection", () => {
        const { result, handleDeleteEvent } = renderHandlers();

        act(() => result.current.setActiveEvent(baseEvent));
        press("x", { ctrlKey: true });

        expect(handleDeleteEvent).toHaveBeenCalledWith(
            "e1",
            EventChangeInitiator.CopyPaste,
        );
        expect(result.current.activeEvent).toBeNull();
    });

    it("Ctrl+C then Ctrl+V pastes a copy keeping the original's duration", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() => result.current.setActiveEvent(baseEvent));
        press("c", { ctrlKey: true });
        press("v", { ctrlKey: true });

        const [ pasted, initiator ] = handleSaveEvent.mock.calls[ 0 ];
        expect(initiator).toBe(EventChangeInitiator.CopyPaste);
        expect(pasted.id).toBeUndefined();
        expect(pasted.ganttEventId).toBeUndefined();
        expect(pasted.endTime.diff(pasted.startTime, "minute")).toBe(60);
        // With no slot selected the copy lands half an hour after the source.
        expect(pasted.startTime.toISOString()).toBe(
            "2026-03-01T08:30:00.000Z",
        );
    });

    it("pastes into the selected slot when there is one", () => {
        const { result, handleSaveEvent } = renderHandlers();

        act(() => result.current.setActiveEvent(baseEvent));
        press("c", { ctrlKey: true });
        act(() =>
            result.current.handleSlotSelect({
                action: "click",
                start: new Date("2026-03-05T12:00:00.000Z"),
                end: new Date("2026-03-05T12:30:00.000Z"),
                resourceId: "Custom:no-room-unassigned",
                slots: [],
            } as never),
        );
        press("v", { ctrlKey: true });

        const [ pasted ] = handleSaveEvent.mock.calls[ 0 ];
        expect(pasted.startTime.toISOString()).toBe(
            "2026-03-05T12:00:00.000Z",
        );
        expect(pasted.endTime.diff(pasted.startTime, "minute")).toBe(60);
        expect(pasted.rooms).toEqual([]);
    });

    it("Ctrl+V with nothing copied does nothing", () => {
        const { handleSaveEvent } = renderHandlers();

        press("v", { ctrlKey: true });

        expect(handleSaveEvent).not.toHaveBeenCalled();
    });

    it("never fires while the user is typing in a field", () => {
        const { result, handleDeleteEvent } = renderHandlers();
        act(() => result.current.setActiveEvent(baseEvent));

        const input = document.createElement("input");
        document.body.appendChild(input);
        act(() => {
            input.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Delete",
                    bubbles: true,
                }),
            );
        });

        expect(handleDeleteEvent).not.toHaveBeenCalled();
    });

    it("never fires while a dialog is open — those keys belong to the form", () => {
        const { result, handleDeleteEvent } = renderHandlers();
        act(() => result.current.setActiveEvent(baseEvent));

        const dialog = document.createElement("div");
        dialog.setAttribute("role", "dialog");
        document.body.appendChild(dialog);
        press("Delete");

        expect(handleDeleteEvent).not.toHaveBeenCalled();
    });
});
