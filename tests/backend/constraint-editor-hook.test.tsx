// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { constraintsState, createConstraint, removeConstraint, updateConstraint } =
    vi.hoisted(() => ({
        constraintsState: {
            value: { constraints: {}, isLoading: false } as {
                constraints: Record<string, unknown>;
                isLoading: boolean;
            },
        },
        createConstraint: vi.fn(async () => undefined),
        removeConstraint: vi.fn(async () => undefined),
        updateConstraint: vi.fn(async () => undefined),
    }));

vi.mock("@/components/gantt/state/constraints/hooks", () => ({
    useGanttConstraints: () => ({
        state: constraintsState.value,
        createConstraint,
        removeConstraint,
        updateConstraint,
    }),
}));

import { GanttDayIndex, GanttModuleId } from "@/api-shared/types/gantt/models";
import {
    ConstraintType,
    GanttConstraint,
} from "@/api-shared/types/gantt/models/constraint";
import { useConstraintEditor } from "@/components/gantt/module-dialog/constraints/use-constraint-editor";

/**
 * The constraint panel's create/edit state machine. Its payload mapping is the
 * part users feel: an empty delay field must mean "no bound", not zero, and a
 * temporal constraint must accept the legacy comma-separated day string a
 * saved row can still carry.
 */
const relationalRow = {
    id: "r1",
    type: ConstraintType.Relational,
    targetId: "e9",
    targetType: "event",
    relation: "after",
    minDelayDays: 2,
    ownerModuleId: "m1",
} as unknown as GanttConstraint;

const temporalRow = {
    id: "t1",
    type: ConstraintType.Temporal,
    allowedDays: [ GanttDayIndex.Sunday ],
    ownerEventId: "e1",
} as unknown as GanttConstraint;

const renderEditor = (
    ownerType: "event" | "module" = "module",
    ownerId = "m1",
) =>
    renderHook(() =>
        useConstraintEditor(ownerType, ownerId as GanttModuleId),
    ).result;

beforeEach(() => {
    vi.clearAllMocks();
    constraintsState.value = {
        constraints: { r1: relationalRow, t1: temporalRow },
        isLoading: false,
    };
});
afterEach(cleanup);

describe("useConstraintEditor — listing", () => {
    it("shows every loaded constraint for a module owner", () => {
        expect(renderEditor().current.constraints).toHaveLength(2);
    });

    it("keeps only the event's own constraints for an event owner", () => {
        const result = renderEditor("event", "e1");

        expect(result.current.constraints.map((c) => c.id)).toEqual([ "t1" ]);
    });

    it("flags mutually impossible temporal constraints as a warning (#104)", () => {
        constraintsState.value = {
            constraints: {
                t1: temporalRow,
                t2: {
                    id: "t2",
                    type: ConstraintType.Temporal,
                    forbiddenDays: [ GanttDayIndex.Sunday ],
                    ownerEventId: "e1",
                } as unknown as GanttConstraint,
            },
            isLoading: false,
        };

        expect(renderEditor("event", "e1").current.hasTemporalConflict).toBe(
            true,
        );
    });
});

describe("useConstraintEditor — create", () => {
    it("starts from a blank relational draft and clears it on cancel", () => {
        const result = renderEditor();

        act(() => result.current.startCreate());
        expect(result.current.draft).toMatchObject({
            type: ConstraintType.Relational,
            relation: "after",
        });

        act(() => result.current.cancelCreate());
        expect(result.current.draft).toBeNull();
    });

    it("stamps the module owner onto the created payload", async () => {
        const result = renderEditor();

        act(() => result.current.startCreate());
        act(() =>
            result.current.setDraft({
                ...result.current.draft!,
                targetId: "e9",
                targetType: "event",
                minDelay: "2",
            }),
        );
        await act(async () => {
            await result.current.submitCreate();
        });

        expect(createConstraint).toHaveBeenCalledWith(
            expect.objectContaining({
                ownerType: "module",
                ownerModuleId: "m1",
                targetId: "e9",
                minDelayDays: 2,
            }),
        );
        expect(result.current.draft).toBeNull();
    });

    it("stamps the event owner instead for an event-level panel", async () => {
        const result = renderEditor("event", "e1");

        act(() => result.current.startCreate());
        await act(async () => {
            await result.current.submitCreate();
        });

        expect(createConstraint).toHaveBeenCalledWith(
            expect.objectContaining({ ownerType: "event", ownerEventId: "e1" }),
        );
    });

    it("sends no delay bounds for empty delay fields", async () => {
        const result = renderEditor();

        act(() => result.current.startCreate());
        await act(async () => {
            await result.current.submitCreate();
        });

        const payload = createConstraint.mock.calls[ 0 ][ 0 ] as Record<
            string,
            unknown
        >;
        expect(payload.minDelayDays).toBeUndefined();
        expect(payload.maxDelayDays).toBeUndefined();
    });

    it("does nothing when submitted with no draft open", async () => {
        const result = renderEditor();

        await act(async () => {
            await result.current.submitCreate();
        });

        expect(createConstraint).not.toHaveBeenCalled();
    });
});

describe("useConstraintEditor — edit", () => {
    it("seeds the form from the saved row, delays as strings", () => {
        const result = renderEditor();

        act(() => result.current.startEdit(relationalRow));

        expect(result.current.editingConstraintId).toBe("r1");
        expect(result.current.editingDraft).toMatchObject({
            targetId: "e9",
            minDelay: "2",
            maxDelay: "",
        });
    });

    it("seeds a temporal row's day lists, defaulting the missing one", () => {
        const result = renderEditor();

        act(() => result.current.startEdit(temporalRow));

        expect(result.current.editingDraft).toMatchObject({
            allowedDays: [ GanttDayIndex.Sunday ],
            forbiddenDays: [],
        });
    });

    it("saves the edit and closes the form", async () => {
        const result = renderEditor();

        act(() => result.current.startEdit(relationalRow));
        await act(async () => {
            await result.current.submitEdit();
        });

        expect(updateConstraint).toHaveBeenCalledWith(
            "r1",
            expect.objectContaining({ targetId: "e9", minDelayDays: 2 }),
        );
        expect(result.current.editingConstraintId).toBeNull();
        expect(result.current.editingDraft).toBeNull();
    });

    it("accepts a legacy comma-separated day list", async () => {
        const result = renderEditor();

        act(() => result.current.startEdit(temporalRow));
        act(() =>
            result.current.setEditingDraft({
                type: ConstraintType.Temporal,
                allowedDays: "0, 2 ,4" as unknown as Array<number>,
                forbiddenDays: [],
            }),
        );
        await act(async () => {
            await result.current.submitEdit();
        });

        expect(updateConstraint).toHaveBeenCalledWith(
            "t1",
            expect.objectContaining({ allowedDays: [ 0, 2, 4 ] }),
        );
    });

    it("discards the edit on cancel", () => {
        const result = renderEditor();

        act(() => result.current.startEdit(relationalRow));
        act(() => result.current.cancelEdit());

        expect(result.current.editingConstraintId).toBeNull();
        expect(updateConstraint).not.toHaveBeenCalled();
    });

    it("does nothing when submitted with no row being edited", async () => {
        const result = renderEditor();

        await act(async () => {
            await result.current.submitEdit();
        });

        expect(updateConstraint).not.toHaveBeenCalled();
    });
});
