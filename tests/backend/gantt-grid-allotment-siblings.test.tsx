// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { moveMapping, applyEventShuffleGroup, createMapping, enqueueSnackbar, removeMapping, setAllottedMinutes } = vi.hoisted(() => ({
    applyEventShuffleGroup: vi.fn(),
    moveMapping: vi.fn(async () => undefined),
    createMapping: vi.fn(async () => undefined),
    removeMapping: vi.fn(async () => undefined),
    enqueueSnackbar: vi.fn(),
    setAllottedMinutes: vi.fn(async () => undefined),
}));

vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() }) }));
vi.mock("@/api-client/gantt", () => ({ ganttApi: {} }));
vi.mock("@/components/base/ApiErrorSnackbar", () => ({ enqueueApiErrorSnackbar: vi.fn() }));
vi.mock("@/components/gantt/state/mappings/hooks", () => ({
    useGanttMappings: () => ({
        createMapping,
        moveMapping,
        refreshMappings: vi.fn(),
        removeMapping,
        setAllottedMinutes,
    }),
}));
vi.mock("@/components/gantt/state/recurrence-exceptions/hooks", () => ({
    useGanttRecurrenceExceptions: () => ({ materializeOccurrence: vi.fn() }),
}));
vi.mock("@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions", () => ({
    useModuleEventActions: () => ({ applyEventShuffleGroup, updateEvent: vi.fn() }),
}));

import { EventRecurrence } from "@/api-shared/types/gantt/models";
import { saveZeroChoice } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-allotment";
import { useGridAllotment } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-grid-allotment";

const map = (eventId: string, dayId: string, allottedMinutes: number) =>
    [ `${eventId}-${dayId}`, { eventId, dayId, allottedMinutes } ] as const;

/** Three grouped shuffle events, all with a mapping on d1 (week 0); `overrides` tweak the mappings. */
const setup = (mappings: Array<readonly [string, unknown]>, grouped = true, fields: object = {}) =>
{
    const event = (shuffle: string) => ({ groupId: grouped ? "g" : undefined, moduleId: "m1", shuffles: [ shuffle ], ...fields });
    const ctx = {
        curriculumId: "c1",
        dateOf: () => undefined,
        exceptions: {},
        linearDays: [ "d1", "d2" ],
        mappings: Object.fromEntries(mappings),
        state: {
            days: { d1: { dayIndex: 0 }, d2: { dayIndex: 1 } },
            events: { a: event("א"), b: event("ב"), c: event("ג") },
        },
        weeks: [ [ "d1" ], [ "d2" ] ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return renderHook(() => useGridAllotment(ctx as any));
};

describe("useGridAllotment sibling suggestion", () =>
{
    afterEach(cleanup);

    beforeEach(() =>
    {
        enqueueSnackbar.mockClear();
        setAllottedMinutes.mockClear();
        removeMapping.mockClear();
        createMapping.mockClear();
        moveMapping.mockClear();
        applyEventShuffleGroup.mockReset();
        window.localStorage.clear();
    });

    it("names only the shuffles whose event had the same week and duration", async () =>
    {
        const { result } = setup([ map("a", "d1", 60), map("b", "d1", 60), map("c", "d1", 90) ]);
        await act(() => result.current.commitWeek("a", "m1", 0, 120));
        expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
        const message = enqueueSnackbar.mock.calls[ 0 ][ 0 ] as string;
        expect(message).toBe("להחיל 2 שעות גם על השאפלים ב?");
    });

    it("stays silent when no sibling matches in that week", async () =>
    {
        const { result } = setup([ map("a", "d1", 60), map("b", "d2", 60), map("c", "d1", 90) ]);
        await act(() => result.current.commitWeek("a", "m1", 0, 120));
        expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it("removes only the edited event's mapping and asks before removing the siblings'", async () =>
    {
        // A remembered "remove" answer must not silently carry over to the siblings.
        saveZeroChoice("remove");
        const { result } = setup([ map("a", "d1", 60), map("b", "d1", 60), map("c", "d1", 60) ]);
        await act(() => result.current.commitWeek("a", "m1", 0, 0));
        expect(removeMapping).toHaveBeenCalledTimes(1);
        expect(removeMapping).toHaveBeenCalledWith({ moduleId: "m1", eventId: "a", dayId: "d1" });
        expect(enqueueSnackbar.mock.calls[ 0 ][ 0 ]).toBe("להסיר את השיבוץ גם מהשאפלים ב, ג?");
    });

    it("keeps a 0-minute mapping, siblings included, when the answer is keep", async () =>
    {
        saveZeroChoice("keep");
        const { result } = setup([ map("a", "d1", 60), map("b", "d1", 60) ]);
        await act(() => result.current.commitWeek("a", "m1", 0, 0));
        expect(removeMapping).not.toHaveBeenCalled();
        expect(setAllottedMinutes).toHaveBeenCalledWith({ moduleId: "m1", eventId: "a", dayId: "d1", allottedMinutes: 0 });
    });

    describe("event shared by every shuffle", () =>
    {
        const shared = { shuffle: "ב", shuffles: [ "א", "ב" ] };
        const click = async (label: string) =>
        {
            const button = await screen.findByText(label);
            await act(async () => button.click());
        };
        const start = (mappings: Array<readonly [string, unknown]>) =>
        {
            const hook = setup(mappings, false);
            const view = render(<>{ hook.result.current.dialog }</>);
            const commit = () => act(async () =>
            {
                void hook.result.current.commitWeek("a", "m1", 0, 120, shared);
            });
            const refresh = () => view.rerender(<>{ hook.result.current.dialog }</>);
            return { commit, refresh, hook };
        };

        it("asks first and edits the event for all shuffles when told so", async () =>
        {
            const { commit, refresh } = start([ map("a", "d1", 60) ]);
            await commit();
            refresh();
            expect(applyEventShuffleGroup).not.toHaveBeenCalled();
            expect(setAllottedMinutes).not.toHaveBeenCalled();
            await click("שנה את כל השאפלים יחד (מומלץ)");
            await vi.waitFor(() => expect(setAllottedMinutes).toHaveBeenCalledTimes(1));
            expect(applyEventShuffleGroup).not.toHaveBeenCalled();
        });

        it("splits per shuffle, copies the placement and edits only the chosen shuffle", async () =>
        {
            applyEventShuffleGroup.mockResolvedValue([
                { id: "a", shuffles: [ "א" ] },
                { id: "n", shuffles: [ "ב" ] },
            ]);
            const { commit, refresh } = start([ map("a", "d1", 60) ]);
            await commit();
            refresh();
            await click("פצל לפי שאפלים");
            await vi.waitFor(() => expect(createMapping).toHaveBeenCalledTimes(1));
            expect(applyEventShuffleGroup).toHaveBeenCalledWith("a", "m1", [ "א", "ב" ]);
            expect(createMapping).toHaveBeenCalledWith({ moduleId: "m1", eventId: "n", dayId: "d1", allottedMinutes: 60 });
        });
    });

    describe("moving an event to another week", () =>
    {
        const plain = { minimumDuration: 60, recurrence: EventRecurrence.None };

        it("moves without asking when the event is a lone, unsplit occurrence worth exactly its duration", async () =>
        {
            const { result } = setup([ map("a", "d1", 60) ], false, plain);
            await act(() => result.current.commitWeek("a", "m1", 1, 60));
            expect(moveMapping).toHaveBeenCalledWith(expect.objectContaining({ eventId: "a", to: { d: "d2" } }));
        });

        it("still asks when the allotted time differs from the duration", async () =>
        {
            const { result } = setup([ map("a", "d1", 30) ], false, plain);
            void result.current.commitWeek("a", "m1", 1, 60);
            await new Promise((r) => setTimeout(r, 20));
            expect(moveMapping).not.toHaveBeenCalled();
        });
    });
});
