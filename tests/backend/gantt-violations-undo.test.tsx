// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { enqueueSnackbar } = vi.hoisted(() => ({ enqueueSnackbar: vi.fn() }));
vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttDayIndex } from "@/api-shared/types/gantt/models";
import {
    ConstraintType,
    GanttConstraint,
} from "@/api-shared/types/gantt/models/constraint";
import { useGanttUndo } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-undo";
import { useGanttViolations } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-violations";

/**
 * Constraint violation flagging (#104) and drag undo (#142). Both are pure
 * enough to pin exactly, and both only misbehave in states an e2e run rarely
 * reaches: an unmapped entity, a target on the same day, a failing undo.
 */

// Sunday..Wednesday, in grid order.
const linearDays = [ "d0", "d1", "d2", "d3" ];
const days = Object.fromEntries(
    linearDays.map((id, index) => [ id, { id, dayIndex: index } ]),
) as unknown as NormalizedStore["days"];

function renderViolations(overrides: {
    constraints?: Record<string, GanttConstraint>;
    events?: Record<string, unknown>;
    modules?: Record<string, unknown>;
    eventMappings?: Record<string, string>;
    moduleMappings?: Record<string, Array<string>>;
}) {
    return renderHook(() =>
        useGanttViolations({
            constraints: overrides.constraints ?? {},
            days,
            eventMappings: overrides.eventMappings ?? {},
            events: (overrides.events ?? {}) as never,
            linearDays,
            moduleMappings: overrides.moduleMappings ?? {},
            modules: (overrides.modules ?? {}) as never,
        }),
    ).result;
}

const temporal = (
    id: string,
    extra: Partial<GanttConstraint>,
): GanttConstraint =>
    ({ id, type: ConstraintType.Temporal, ...extra }) as GanttConstraint;

const relational = (
    id: string,
    extra: Partial<GanttConstraint>,
): GanttConstraint =>
    ({
        id,
        type: ConstraintType.Relational,
        targetType: "event",
        relation: "after",
        ...extra,
    }) as GanttConstraint;

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("useGanttViolations — temporal", () => {
    it("flags an event sitting on a day its constraint forbids", () => {
        const constraint = temporal("t1", {
            forbiddenDays: [ GanttDayIndex.Monday ],
        });
        const result = renderViolations({
            constraints: { t1: constraint },
            events: { e1: { id: "e1", constraints: [ constraint ] } },
            eventMappings: { e1: "d1" },
        });

        expect(result.current.violations.e1).toContain(
            "מפר ימי עבודה אסורים",
        );
    });

    it("flags an event outside its allowed days, and clears when it moves back", () => {
        const constraint = temporal("t1", {
            allowedDays: [ GanttDayIndex.Sunday ],
        });
        const args = {
            constraints: { t1: constraint },
            events: { e1: { id: "e1", constraints: [ constraint ] } },
        };

        expect(
            renderViolations({ ...args, eventMappings: { e1: "d2" } }).current
                .violations.e1,
        ).toContain("מפר ימי עבודה מותרים");

        cleanup();

        expect(
            renderViolations({ ...args, eventMappings: { e1: "d0" } }).current
                .violations.e1,
        ).toBeUndefined();
    });

    it("flags mutually impossible temporal constraints before anything is placed", () => {
        const allowed = temporal("t1", {
            allowedDays: [ GanttDayIndex.Sunday ],
        });
        const forbidden = temporal("t2", {
            forbiddenDays: [ GanttDayIndex.Sunday ],
        });

        const result = renderViolations({
            constraints: { t1: allowed, t2: forbidden },
            events: { e1: { id: "e1", constraints: [ allowed, forbidden ] } },
        });

        expect(result.current.violations.e1).toContain(
            "אילוצים סותרים: לא נותר אף יום חוקי",
        );
    });

    it("says nothing about an unmapped, unconflicted entity", () => {
        const constraint = temporal("t1", {
            forbiddenDays: [ GanttDayIndex.Monday ],
        });

        const result = renderViolations({
            constraints: { t1: constraint },
            events: { e1: { id: "e1", constraints: [ constraint ] } },
        });

        expect(result.current.violations).toEqual({});
    });
});

describe("useGanttViolations — relational", () => {
    const linkArgs = (extra: Partial<GanttConstraint>, sourceDay: string) => {
        const constraint = relational("r1", { targetId: "e2", ...extra });
        return {
            constraints: { r1: constraint },
            events: {
                e1: { id: "e1", constraints: [ constraint ] },
                e2: { id: "e2", constraints: [] },
            },
            eventMappings: { e1: sourceDay, e2: "d1" },
        };
    };

    it("accepts an 'after' constraint that is satisfied", () => {
        const result = renderViolations(linkArgs({}, "d2"));

        expect(result.current.violations.e1).toBeUndefined();
        expect(result.current.activeLinks).toHaveLength(1);
        expect(result.current.activeLinks[ 0 ]).toMatchObject({
            sourceId: "block-event-e1",
            targetId: "block-event-e2",
            isViolated: false,
        });
    });

    it("flags an 'after' constraint whose source sits on or before its target", () => {
        expect(
            renderViolations(linkArgs({}, "d1")).current.violations.e1,
        ).toBeDefined();
        cleanup();
        expect(
            renderViolations(linkArgs({}, "d0")).current.violations.e1,
        ).toBeDefined();
    });

    it("enforces the minimum and maximum delay", () => {
        expect(
            renderViolations(linkArgs({ minDelayDays: 2 }, "d2")).current
                .violations.e1,
        ).toBeDefined();
        cleanup();
        expect(
            renderViolations(linkArgs({ maxDelayDays: 1 }, "d3")).current
                .violations.e1,
        ).toBeDefined();
        cleanup();
        expect(
            renderViolations(linkArgs({ minDelayDays: 1, maxDelayDays: 2 }, "d2"))
                .current.violations.e1,
        ).toBeUndefined();
    });

    it("flags a 'before' constraint pointing the wrong way", () => {
        expect(
            renderViolations(linkArgs({ relation: "before" }, "d2")).current
                .violations.e1,
        ).toBeDefined();
        cleanup();
        expect(
            renderViolations(linkArgs({ relation: "before" }, "d0")).current
                .violations.e1,
        ).toBeUndefined();
    });

    it("draws no link at all while the target is unmapped", () => {
        const constraint = relational("r1", { targetId: "e2" });
        const result = renderViolations({
            constraints: { r1: constraint },
            events: {
                e1: { id: "e1", constraints: [ constraint ] },
                e2: { id: "e2", constraints: [] },
            },
            eventMappings: { e1: "d2" },
        });

        expect(result.current.activeLinks).toEqual([]);
        expect(result.current.violations).toEqual({});
    });

    it("uses a module's earliest mapped day as its position", () => {
        const constraint = relational("r1", {
            targetId: "m1",
            targetType: "module",
        });
        const result = renderViolations({
            constraints: { r1: constraint },
            events: { e1: { id: "e1", constraints: [ constraint ] } },
            modules: { m1: { id: "m1", constraints: [] } },
            eventMappings: { e1: "d2" },
            moduleMappings: { m1: [ "d3", "d1" ] },
        });

        // Earliest is d1, so e1 on d2 is genuinely after it.
        expect(result.current.violations.e1).toBeUndefined();
        expect(result.current.activeLinks[ 0 ].targetId).toBe(
            "block-module-m1",
        );
    });

    it("ignores a constraint id that no longer resolves", () => {
        const result = renderViolations({
            constraints: {},
            events: { e1: { id: "e1", constraints: [ { id: "gone" } ] } },
            eventMappings: { e1: "d1" },
        });

        expect(result.current.violations).toEqual({});
        expect(result.current.activeLinks).toEqual([]);
    });
});

describe("useGanttUndo", () => {
    function press(key = "z", init: KeyboardEventInit = {}) {
        act(() => {
            window.dispatchEvent(
                new KeyboardEvent("keydown", { key, ctrlKey: true, ...init }),
            );
        });
    }

    it("pops the most recent action first", async () => {
        const first = vi.fn(async () => undefined);
        const second = vi.fn(async () => undefined);
        const result = renderHook(() => useGanttUndo()).result;

        act(() => result.current.pushUndo(first));
        act(() => result.current.pushUndo(second));
        press();

        await waitFor(() => expect(second).toHaveBeenCalled());
        expect(first).not.toHaveBeenCalled();
    });

    it("reports a failed undo instead of swallowing it", async () => {
        const result = renderHook(() => useGanttUndo()).result;

        act(() =>
            result.current.pushUndo(async () => {
                throw new Error("server said no");
            }),
        );
        press();

        await waitFor(() =>
            expect(enqueueSnackbar).toHaveBeenCalledWith(
                "ביטול הפעולה נכשל!",
                { variant: "error" },
            ),
        );
    });

    it("does nothing on an empty stack", async () => {
        renderHook(() => useGanttUndo());

        press();

        await Promise.resolve();
        expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it("ignores Ctrl+Shift+Z and other keys", async () => {
        const undo = vi.fn(async () => undefined);
        const result = renderHook(() => useGanttUndo()).result;
        act(() => result.current.pushUndo(undo));

        press("z", { shiftKey: true });
        press("y");

        await Promise.resolve();
        expect(undo).not.toHaveBeenCalled();
    });

    it("never steals Ctrl+Z from a text field", async () => {
        const undo = vi.fn(async () => undefined);
        const result = renderHook(() => useGanttUndo()).result;
        act(() => result.current.pushUndo(undo));

        const input = document.createElement("textarea");
        document.body.appendChild(input);
        act(() => {
            input.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "z",
                    ctrlKey: true,
                    bubbles: true,
                }),
            );
        });

        await Promise.resolve();
        expect(undo).not.toHaveBeenCalled();
        input.remove();
    });

    it("bounds the stack, dropping the oldest action", async () => {
        const result = renderHook(() => useGanttUndo()).result;
        const calls: Array<number> = [];

        for (let i = 0; i < 51; i++) {
            act(() =>
                result.current.pushUndo(async () => {
                    calls.push(i);
                }),
            );
        }
        // Drain the whole stack; the first push must have been evicted.
        for (let i = 0; i < 51; i++) {
            await act(async () => {
                await result.current.handleUndo();
            });
        }

        expect(calls).toHaveLength(50);
        expect(calls).not.toContain(0);
    });
});
