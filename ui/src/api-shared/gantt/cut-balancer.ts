import {
    CAPACITY_RULES,
    isSpillable,
    NEVER_SCHEDULE_DAY_INDICES,
    OVERFLOW_RULES,
    SPILLOVER_RULES,
    WeekOverflowResolution,
} from "@/api-shared/gantt/cut-rules";
import { GanttDayIndex } from "@/api-shared/types/gantt/models/day";

/**
 * Auto-spillover balancer for the cut ("איזון אוטומטי של השבוע").
 *
 * Pure, minute-domain and calendar-free: it rearranges *which day* each slot
 * sits on, never what time it starts. Time materialization stays in the
 * planner, which runs this pass before it stacks anything.
 *
 * Every policy decision it makes is read from `cut-rules.ts` — this file holds
 * the mechanism, that one holds the rules.
 */

/** One placeable unit of work on a day, before it has a clock time. */
export type BalancerSlot = {
    /** Stable key, unique within a plan: `${eventId}@${dayId}#${ordinal}`. */
    key: string;
    eventId: string;
    /** Duration in minutes, already resolved from allocated/minimum. */
    durationMinutes: number;
    /** Gantt module the event belongs to; drives module cohesion. */
    moduleId: null | string;
    isRecurrenceEcho: boolean;
    isDailyRecurrence: boolean;
    isPinnedMeal: boolean;
    /** Original position within its day, preserved for stable ordering. */
    sortOrder: number;
};

export type BalancerDay = {
    id: string;
    dayIndex: GanttDayIndex;
    /** Minutes between the day's start time and its end time. */
    capacityMinutes: number;
};

export type BalancerWeek = {
    id: string;
    /** Day ids in display order. */
    dayIds: Array<string>;
};

export type BalancerInput = {
    weeks: Array<BalancerWeek>;
    days: Record<string, BalancerDay>;
    /** Slots keyed by the day they are currently mapped to. */
    slotsByDay: Map<string, Array<BalancerSlot>>;
};

/** A slot the balancer relocated, reported for the preview's diff highlight. */
export type SpillMove = {
    slotKey: string;
    eventId: string;
    fromDayId: string;
    toDayId: string;
    durationMinutes: number;
};

/** A week whose load exceeds its own working hours even after balancing. */
export type WeekOverflow = {
    weekId: string;
    /** Minutes of load that could not be placed inside any day's window. */
    excessMinutes: number;
    /** Day ids still over capacity, with their overflow. */
    overloadedDays: Array<{ dayId: string; overflowMinutes: number }>;
    /** What the balancer did, absent a user decision. */
    appliedResolution: WeekOverflowResolution;
};

export type BalancerResult = {
    slotsByDay: Map<string, Array<BalancerSlot>>;
    moves: Array<SpillMove>;
    overflows: Array<WeekOverflow>;
};

/** Total minutes currently sitting on a day. */
function loadOf(slots: Array<BalancerSlot> | undefined): number {
    return (slots ?? []).reduce((sum, slot) => sum + slot.durationMinutes, 0);
}

/** Whether a day may ever receive relocated work. */
function isSpillTarget(day: BalancerDay | undefined): day is BalancerDay {
    if (!day) return false;
    if (NEVER_SCHEDULE_DAY_INDICES.includes(day.dayIndex)) return false;
    return day.capacityMinutes > 0;
}

/**
 * Fitness of moving `slot` onto `targetSlots`. Higher is better; `null` means
 * the move is illegal (it would not fit the target's remaining window).
 *
 * Best-fit: the score rewards tight packing — a move that leaves the least
 * slack behind wins — then adjusts for module cohesion so siblings from one
 * module stay on one day when the packing is otherwise comparable.
 */
function scoreMove(
    slot: BalancerSlot,
    target: BalancerDay,
    targetSlots: Array<BalancerSlot>,
): null | number {
    const remaining = target.capacityMinutes - loadOf(targetSlots);
    if (remaining < slot.durationMinutes) return null;

    const leftover = remaining - slot.durationMinutes;
    // Tighter packing scores higher; a perfect fit scores best.
    let score = -leftover;

    if (slot.moduleId) {
        const joinsSiblings = targetSlots.some(
            (other) => other.moduleId === slot.moduleId,
        );
        if (joinsSiblings) score += SPILLOVER_RULES.moduleCohesionBonusMinutes;
    }

    return score;
}

/**
 * Penalty for tearing `slot` away from same-module siblings left behind on the
 * source day. Subtracted from a candidate's desirability so the balancer
 * prefers to move a lone event over splitting a module.
 */
function splitPenaltyOf(
    slot: BalancerSlot,
    sourceSlots: Array<BalancerSlot>,
): number {
    if (!slot.moduleId) return 0;
    const siblingsRemaining = sourceSlots.some(
        (other) => other.key !== slot.key && other.moduleId === slot.moduleId,
    );
    return siblingsRemaining ? SPILLOVER_RULES.moduleSplitPenaltyMinutes : 0;
}

/**
 * Rebalance every week so no day carries more than its working window, moving
 * work only forward and only within its own week.
 *
 * The invariants enforced here mirror {@link SPILLOVER_RULES}:
 * spill never crosses a week boundary, never lands on a day that cannot hold
 * the event inside its window, and never places anything past a day's end.
 * When a week cannot absorb its own load, the leftover stays where it was
 * mapped (overlapping) and the week is reported as an overflow for the dialog
 * to resolve.
 */
export function balanceWeeks(input: BalancerInput): BalancerResult {
    const slotsByDay = new Map<string, Array<BalancerSlot>>();
    for (const [dayId, slots] of input.slotsByDay) {
        slotsByDay.set(dayId, [...slots]);
    }

    const moves: Array<SpillMove> = [];
    const overflows: Array<WeekOverflow> = [];

    for (const week of input.weeks) {
        // Days are processed in order so spill cascades forward: work pushed
        // off ראשון can be pushed again off שני if שני fills up too.
        for (let index = 0; index < week.dayIds.length; index++) {
            const sourceId = week.dayIds[index];
            const source = input.days[sourceId];
            if (!source) continue;

            const laterDayIds = week.dayIds
                .slice(index + 1)
                .filter((id) => isSpillTarget(input.days[id]));
            if (laterDayIds.length === 0) continue;

            // Keep moving the best candidate until the day fits its window or
            // nothing legal is left to move.
            for (;;) {
                const sourceSlots = slotsByDay.get(sourceId) ?? [];
                const overflow = loadOf(sourceSlots) - source.capacityMinutes;
                if (overflow <= CAPACITY_RULES.negligibleSlackMinutes) break;

                const best = pickBestMove(
                    sourceSlots,
                    laterDayIds,
                    input.days,
                    slotsByDay,
                );
                if (!best) break;

                const targetSlots = slotsByDay.get(best.targetId) ?? [];
                slotsByDay.set(
                    sourceId,
                    sourceSlots.filter((slot) => slot.key !== best.slot.key),
                );
                slotsByDay.set(best.targetId, [...targetSlots, best.slot]);
                moves.push({
                    slotKey: best.slot.key,
                    eventId: best.slot.eventId,
                    fromDayId: sourceId,
                    toDayId: best.targetId,
                    durationMinutes: best.slot.durationMinutes,
                });
            }
        }

        // Whatever is still over capacity could not be placed anywhere in the
        // week — report it rather than inventing hours.
        const overloadedDays = week.dayIds
            .map((dayId) => {
                const day = input.days[dayId];
                if (!day) return null;
                const overflowMinutes =
                    loadOf(slotsByDay.get(dayId)) - day.capacityMinutes;
                return overflowMinutes > CAPACITY_RULES.negligibleSlackMinutes
                    ? { dayId, overflowMinutes }
                    : null;
            })
            .filter((entry): entry is { dayId: string; overflowMinutes: number } =>
                entry !== null,
            );

        if (overloadedDays.length > 0) {
            overflows.push({
                weekId: week.id,
                excessMinutes: overloadedDays.reduce(
                    (sum, day) => sum + day.overflowMinutes,
                    0,
                ),
                overloadedDays,
                appliedResolution: OVERFLOW_RULES.defaultResolution,
            });
        }
    }

    // Restore each day's original relative ordering: a relocated slot keeps its
    // sortOrder, so it slots into the target day where the user would expect.
    for (const [dayId, slots] of slotsByDay) {
        slotsByDay.set(
            dayId,
            [...slots].sort((a, b) => a.sortOrder - b.sortOrder),
        );
    }

    return { slotsByDay, moves, overflows };
}

/**
 * The single best (slot, target day) pair to relocate out of an over-full day,
 * or null when no legal move exists.
 */
function pickBestMove(
    sourceSlots: Array<BalancerSlot>,
    laterDayIds: Array<string>,
    days: Record<string, BalancerDay>,
    slotsByDay: Map<string, Array<BalancerSlot>>,
): { slot: BalancerSlot; targetId: string } | null {
    let best: { score: number; slot: BalancerSlot; targetId: string } | null =
        null;

    for (const slot of sourceSlots) {
        if (!isSpillable(slot)) continue;
        const penalty = splitPenaltyOf(slot, sourceSlots);

        for (const targetId of laterDayIds) {
            const target = days[targetId];
            if (!target) continue;
            const score = scoreMove(
                slot,
                target,
                slotsByDay.get(targetId) ?? [],
            );
            if (score === null) continue;

            const adjusted = score - penalty;
            if (!best || adjusted > best.score) {
                best = { score: adjusted, slot, targetId };
            }
        }
    }

    return best ? { slot: best.slot, targetId: best.targetId } : null;
}
