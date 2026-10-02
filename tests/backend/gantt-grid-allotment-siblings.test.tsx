// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueueSnackbar, setAllottedMinutes } = vi.hoisted(() => ({
    enqueueSnackbar: vi.fn(),
    setAllottedMinutes: vi.fn(async () => undefined),
}));

vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() }) }));
vi.mock("@/api-client/gantt", () => ({ ganttApi: {} }));
vi.mock("@/components/base/ApiErrorSnackbar", () => ({ enqueueApiErrorSnackbar: vi.fn() }));
vi.mock("@/components/gantt/state/mappings/hooks", () => ({
    useGanttMappings: () => ({
        createMapping: vi.fn(),
        moveMapping: vi.fn(),
        refreshMappings: vi.fn(),
        removeMapping: vi.fn(),
        setAllottedMinutes,
    }),
}));
vi.mock("@/components/gantt/state/recurrence-exceptions/hooks", () => ({
    useGanttRecurrenceExceptions: () => ({ materializeOccurrence: vi.fn() }),
}));
vi.mock("@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions", () => ({
    useModuleEventActions: () => ({ updateEvent: vi.fn() }),
}));

import { useGridAllotment } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-grid-allotment";

const map = (eventId: string, dayId: string, allottedMinutes: number) =>
    [ `${eventId}-${dayId}`, { eventId, dayId, allottedMinutes } ] as const;

/** Three grouped shuffle events, all with a mapping on d1 (week 0); `overrides` tweak the mappings. */
const setup = (mappings: Array<readonly [string, unknown]>) =>
{
    const event = (shuffle: string) => ({ groupId: "g", moduleId: "m1", shuffles: [ shuffle ] });
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
    beforeEach(() =>
    {
        enqueueSnackbar.mockClear();
        setAllottedMinutes.mockClear();
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
});
