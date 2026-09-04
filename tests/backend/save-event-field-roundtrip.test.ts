// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `createEventFactory` rebuilds the Event object field-by-field on every save
 * (drag, resize, dialog edit) and previously dropped ganttEventId/
 * ganttOccurrenceDate/hiveQueues silently, with no test to catch it (#498).
 *
 * Covers the full `saveEvent` path (UseEventActions.ts), not just the factory
 * in isolation, so a regression in either place fails a test.
 */

const { apiCreateEvent, apiUpdateEvent } = vi.hoisted(() => ({
    apiCreateEvent: vi.fn(),
    apiUpdateEvent: vi.fn(),
}));

vi.mock("@/api-client/calendar", () => ({
    apiCreateEvent,
    apiDeleteEvent: vi.fn(),
    apiUpdateEvent,
}));
vi.mock("notistack", () => ({ enqueueSnackbar: vi.fn() }));

import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { useEventActions } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventActions";
import { Event, EventType } from "@/components/schedule/types/event";

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

// Every optional field a save must never silently drop.
const OPTIONAL_FIELDS: Partial<Event> = {
    color: "custom-1",
    fake: true,
    ganttEventId: "gantt-evt-1",
    ganttOccurrenceDate: "2024-03-04",
    hiveQueues: { "course-1": 42 },
};

const REQUIRED_FIELDS: Partial<Event> = {
    courses: ["course-1"],
    hiveModule: 3,
    instructors: [],
    lecturers: [],
    locked: false,
    name: "Test Event",
    notes: "",
    rooms: [],
    subject: 1,
    tags: [],
    type: EventType.EXERCISE,
};

function renderActions(events: Array<Event> = []) {
    const dispatch = vi.fn();
    const remoteDispatch = vi.fn();
    const captureEventBeforeEdit = vi.fn();
    const markEventCreatedLocally = vi.fn();

    const { result } = renderHook(() =>
        useEventActions(
            events,
            false,
            captureEventBeforeEdit,
            dispatch,
            remoteDispatch,
            markEventCreatedLocally,
        ),
    );

    return { dispatch, remoteDispatch, result };
}

function optimisticPayload(dispatch: ReturnType<typeof vi.fn>): Event {
    const upsertCall = dispatch.mock.calls.find(
        ([action]) => action.type === "UPSERT_EVENT",
    );
    expect(upsertCall).toBeDefined();
    return upsertCall![0].payload as Event;
}

describe("saveEvent field round-trip", () => {
    it("carries every optional field through the new-event path", async () => {
        apiCreateEvent.mockImplementation(async (event: Event) => event);
        const { dispatch, result } = renderActions();

        act(() => {
            result.current.saveEvent({
                ...REQUIRED_FIELDS,
                ...OPTIONAL_FIELDS,
                startTime: dayjs("2024-03-04T08:00:00"),
                endTime: dayjs("2024-03-04T09:00:00"),
            });
        });

        const optimistic = optimisticPayload(dispatch);
        for (const [key, value] of Object.entries(OPTIONAL_FIELDS)) {
            expect(optimistic[key as keyof Event]).toEqual(value);
        }
        expect(optimistic.updatedAt).toBeTypeOf("number");

        await vi.waitFor(() => expect(apiCreateEvent).toHaveBeenCalled());
        const [sentEvent] = apiCreateEvent.mock.calls[0];
        for (const [key, value] of Object.entries(OPTIONAL_FIELDS)) {
            expect(sentEvent[key]).toEqual(value);
        }
        expect(sentEvent.updatedAt).toBeTypeOf("number");
    });

    it("carries every optional field through the update (dialog edit) path", async () => {
        const existing: Event = {
            ...(REQUIRED_FIELDS as Event),
            id: "evt-1",
            endTime: dayjs("2024-03-04T09:00:00"),
            splitAcrossBreaks: false,
            startTime: dayjs("2024-03-04T08:00:00"),
        };
        apiUpdateEvent.mockImplementation(async (event: Event) => event);
        const { dispatch, result } = renderActions([existing]);

        act(() => {
            result.current.saveEvent({
                ...existing,
                ...OPTIONAL_FIELDS,
                notes: "edited",
            });
        });

        const optimistic = optimisticPayload(dispatch);
        for (const [key, value] of Object.entries(OPTIONAL_FIELDS)) {
            expect(optimistic[key as keyof Event]).toEqual(value);
        }

        await vi.waitFor(() => expect(apiUpdateEvent).toHaveBeenCalled());
        const [sentEvent] = apiUpdateEvent.mock.calls[0];
        for (const [key, value] of Object.entries(OPTIONAL_FIELDS)) {
            expect(sentEvent[key]).toEqual(value);
        }
    });

    it("preserves untouched optional fields through a resize/drag save (partial time-only payload)", async () => {
        const existing: Event = {
            ...(REQUIRED_FIELDS as Event),
            ...OPTIONAL_FIELDS,
            id: "evt-2",
            endTime: dayjs("2024-03-04T09:00:00"),
            splitAcrossBreaks: false,
            startTime: dayjs("2024-03-04T08:00:00"),
        };
        apiUpdateEvent.mockImplementation(async (event: Event) => event);
        const { dispatch, result } = renderActions([existing]);

        // Mirrors a drag/resize: full previous event spread with only the
        // time fields actually changed, same shape the calendar grid sends.
        act(() => {
            result.current.saveEvent(
                {
                    ...existing,
                    endTime: dayjs("2024-03-04T11:00:00"),
                    startTime: dayjs("2024-03-04T10:00:00"),
                },
                EventChangeInitiator.DragDrop,
            );
        });

        const optimistic = optimisticPayload(dispatch);
        for (const [key, value] of Object.entries(OPTIONAL_FIELDS)) {
            expect(optimistic[key as keyof Event]).toEqual(value);
        }
        expect(optimistic.startTime.isSame(dayjs("2024-03-04T10:00:00"))).toBe(
            true,
        );

        await vi.waitFor(() => expect(apiUpdateEvent).toHaveBeenCalled());
        const [sentEvent] = apiUpdateEvent.mock.calls[0];
        for (const [key, value] of Object.entries(OPTIONAL_FIELDS)) {
            expect(sentEvent[key]).toEqual(value);
        }
    });

    it("leaves optional fields undefined when never set, rather than inventing defaults", async () => {
        apiCreateEvent.mockImplementation(async (event: Event) => event);
        const { dispatch, result } = renderActions();

        act(() => {
            result.current.saveEvent({
                ...REQUIRED_FIELDS,
                startTime: dayjs("2024-03-04T08:00:00"),
                endTime: dayjs("2024-03-04T09:00:00"),
            });
        });

        const optimistic = optimisticPayload(dispatch);
        expect(optimistic.color).toBeUndefined();
        expect(optimistic.fake).toBe(false);
        expect(optimistic.ganttEventId).toBeUndefined();
        expect(optimistic.ganttOccurrenceDate).toBeUndefined();
        expect(optimistic.hiveQueues).toBeUndefined();
    });

    it("explains the refusal when the event has no name (#612)", async () => {
        const { enqueueSnackbar } = await import("notistack");
        const { dispatch, result } = renderActions();

        act(() => {
            result.current.saveEvent({
                ...REQUIRED_FIELDS,
                name: "",
                startTime: dayjs("2024-03-04T08:00:00"),
                endTime: dayjs("2024-03-04T09:00:00"),
            });
        });

        // Still refused — but the drag no longer just snaps back in silence.
        expect(dispatch).not.toHaveBeenCalled();
        expect(apiCreateEvent).not.toHaveBeenCalled();
        expect(enqueueSnackbar).toHaveBeenCalledWith(
            "לא ניתן לשמור אירוע ללא שם.",
            { variant: "warning" },
        );
    });
});
