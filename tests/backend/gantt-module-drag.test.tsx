// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { commit, enqueueSnackbar } = vi.hoisted(() => ({ commit: vi.fn(), enqueueSnackbar: vi.fn() }));
vi.mock("@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-undo", () => ({
    useGanttUndo: () => ({ commit }),
}));
vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

import {
    canDragModule,
    moduleMappingsOf,
    planModuleMap,
    planModuleShift,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/module-drag";
import { useGanttDrag } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-drag";

/**
 * רצף זמן module drag: draggable only while every event is unallocated or in
 * range; mapping places every event on the drop day; shifting moves events
 * relatively; the unmap zone takes every event off the timeline.
 */

const linearDays = [ "d0", "d1", "d2", "d3", "d4", "d5" ];
const eventIds = [ "e1", "e2", "e3" ];

describe("canDragModule", () => {
    it("allows a fully unallocated module", () => {
        expect(canDragModule({ eventIds, eventMappings: {} }, linearDays)).toBe(true);
    });

    it("allows a mix of unallocated and in-range events", () => {
        expect(canDragModule({ eventIds, eventMappings: { e1: "d1", e3: "d4" } }, linearDays)).toBe(true);
    });

    it("blocks when any event is mapped outside the timeline", () => {
        expect(canDragModule({ eventIds, eventMappings: { e1: "d1", e2: "gone" } }, linearDays)).toBe(false);
    });
});

describe("planModuleMap", () => {
    it("places every unallocated event", () => {
        expect(planModuleMap({ eventIds, eventMappings: { e2: "d3" } })).toEqual([ "e1", "e3" ]);
    });
});

describe("planModuleShift", () => {
    const mappings = moduleMappingsOf({ eventIds, eventMappings: { e1: "d1", e2: "d3" } }, []);

    it("moves events relatively, leading edge first", () => {
        expect(planModuleShift(mappings, linearDays, 2)).toEqual([
            { eventId: "e2", from: "d3", to: "d5" },
            { eventId: "e1", from: "d1", to: "d3" },
        ]);
        expect(planModuleShift(mappings, linearDays, -1)).toEqual([
            { eventId: "e1", from: "d1", to: "d0" },
            { eventId: "e2", from: "d3", to: "d2" },
        ]);
    });

    it("moves nothing when any event would leave the timeline", () => {
        expect(planModuleShift(mappings, linearDays, 3)).toBeNull();
        expect(planModuleShift(mappings, linearDays, -2)).toBeNull();
    });

    it("regression: ignores stale module-level mappings of a module with events", () => {
        const withStale = moduleMappingsOf({ eventIds, eventMappings: { e1: "d1" } }, [ "d5" ]);

        expect(planModuleShift(withStale, linearDays, 1)).toEqual([ { eventId: "e1", from: "d1", to: "d2" } ]);
    });

    it("shifts an event-less module by its module-level mappings", () => {
        const own = moduleMappingsOf({ eventIds: [], eventMappings: {} }, [ "d0" ]);

        expect(planModuleShift(own, linearDays, 1)).toEqual([ { eventId: null, from: "d0", to: "d1" } ]);
    });
});

afterEach(() => vi.clearAllMocks());

const labels = {
    itemName: (item?: { eventId?: null | string; moduleId?: string }) => `"${item?.eventId ?? item?.moduleId}"`,
    dayLabel: (dayId: string) => `יום ${dayId}`,
};

function setup(
    eventMappings: Record<string, string>,
    moduleMappings: Record<string, Array<string>> = {},
    { ok = true } = {},
) {
    const createMapping = vi.fn(async () => (ok ? { id: "mapping" } : undefined));
    const moveMapping = vi.fn(async () => ok);
    const removeMapping = vi.fn(async () => ok);
    const { result } = renderHook(() =>
        useGanttDrag({
            linearDays,
            modulesById: { m1: { id: "m1", events: eventIds } } as never,
            moduleMappings,
            eventMappings,
            createMapping: createMapping as never,
            moveMapping: moveMapping as never,
            removeMapping: removeMapping as never,
            deleteOccurrence: vi.fn() as never,
            labels,
        }),
    );
    const drop = (payload: object, target: object) =>
        act(() => result.current.handleDragEnd({
            active: { data: { current: payload } },
            over: { data: { current: target } },
        } as never));
    return { createMapping, moveMapping, removeMapping, drop };
}

describe("useGanttDrag module drops", () => {
    it("mapping an unallocated module puts every event on the drop day", async () => {
        const { createMapping, drop } = setup({});

        await drop({ type: "module-map", moduleId: "m1" }, { targetType: "module", dayId: "d2" });

        expect(createMapping.mock.calls.map(([ arg ]) => arg)).toEqual(
            eventIds.map((eventId) => ({ moduleId: "m1", eventId, dayId: "d2" })),
        );
    });

    it("shifting a mapped module moves its events relatively", async () => {
        const { moveMapping, drop } = setup({ e1: "d0", e2: "d2" });

        await drop(
            { type: "module-shift", moduleId: "m1", sourceDayId: "d0" },
            { targetType: "module", dayId: "d1" },
        );

        expect(moveMapping.mock.calls.map(([ arg ]) => arg)).toEqual([
            { moduleId: "m1", eventId: "e2", from: { d: "d2" }, to: { d: "d3" } },
            { moduleId: "m1", eventId: "e1", from: { d: "d0" }, to: { d: "d1" } },
        ]);
    });

    it("refuses a shift that would push an event off the timeline", async () => {
        const { moveMapping, drop } = setup({ e1: "d0", e2: "d4" });

        await drop(
            { type: "module-shift", moduleId: "m1", sourceDayId: "d0" },
            { targetType: "module", dayId: "d2" },
        );

        expect(moveMapping).not.toHaveBeenCalled();
    });

    it("the unmap zone removes every event of the module from the timeline", async () => {
        const { removeMapping, drop } = setup({ e1: "d0", e3: "d4" }, { m1: [ "d1" ] });

        await drop({ type: "module-shift", moduleId: "m1", sourceDayId: "d0" }, { targetType: "remove" });

        expect(removeMapping.mock.calls.map(([ arg ]) => arg)).toEqual([
            { moduleId: "m1", eventId: "e1", dayId: "d0" },
            { moduleId: "m1", eventId: "e3", dayId: "d4" },
            { moduleId: "m1", eventId: null, dayId: "d1" },
        ]);
    });
});

describe("useGanttDrag drop feedback (#810)", () => {
    it("confirms a drop with what moved where", async () => {
        const { drop } = setup({ e1: "d0" });

        await drop(
            { type: "event-move", moduleId: "m1", eventId: "e1", sourceDayId: "d0" },
            { targetType: "event", dayId: "d2" },
        );

        expect(commit).toHaveBeenCalledTimes(1);
        expect(commit.mock.calls[ 0 ][ 0 ].label).toBe("\"e1\" הועבר ליום d2");
    });

    it("explains a refused shift instead of doing nothing silently", async () => {
        const { moveMapping, drop } = setup({ e1: "d0", e2: "d4" });

        await drop(
            { type: "module-shift", moduleId: "m1", sourceDayId: "d0" },
            { targetType: "module", dayId: "d2" },
        );

        expect(moveMapping).not.toHaveBeenCalled();
        expect(commit).not.toHaveBeenCalled();
        expect(enqueueSnackbar).toHaveBeenCalledWith(
            "לא ניתן להזיז את \"m1\" — מופעים יחרגו מסוף הציר",
            { variant: "warning" },
        );
    });

    it("doesn't confirm (or offer to undo) a drop the server refused", async () => {
        const { drop } = setup({}, {}, { ok: false });

        await drop({ type: "event-map", moduleId: "m1", eventId: "e1" }, { targetType: "event", dayId: "d1" });

        expect(commit).not.toHaveBeenCalled();
    });

    it("reports an unexpected failure through the API error snackbar", async () => {
        const { createMapping, drop } = setup({});
        createMapping.mockRejectedValueOnce(new Error("boom"));

        await drop({ type: "event-map", moduleId: "m1", eventId: "e1" }, { targetType: "event", dayId: "d1" });

        expect(commit).not.toHaveBeenCalled();
        expect(enqueueSnackbar).toHaveBeenCalled();
    });

    it("regression: undoing a shift replays the captured days in reverse, not a stale re-plan", async () => {
        const { moveMapping, drop } = setup({ e1: "d0", e2: "d2" });
        await drop(
            { type: "module-shift", moduleId: "m1", sourceDayId: "d0" },
            { targetType: "module", dayId: "d1" },
        );
        moveMapping.mockClear();

        await act(() => commit.mock.calls[ 0 ][ 0 ].undo());

        expect(moveMapping.mock.calls.map(([ arg ]) => arg)).toEqual([
            { moduleId: "m1", eventId: "e1", from: { d: "d1" }, to: { d: "d0" } },
            { moduleId: "m1", eventId: "e2", from: { d: "d3" }, to: { d: "d2" } },
        ]);
    });
});
