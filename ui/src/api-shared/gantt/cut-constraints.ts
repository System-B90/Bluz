import { CONSTRAINT_RULES, NEVER_SCHEDULE_DAY_INDICES } from "@/api-shared/gantt/cut-rules";
import {
    ConstraintType,
    GanttConstraint,
    RelationalConstraint,
    TemporalConstraint,
} from "@/api-shared/types/gantt/models/constraint";
import { GanttDayIndex } from "@/api-shared/types/gantt/models/day";

/**
 * Constraint pass for the cut.
 *
 * Two jobs, both governed by `CONSTRAINT_RULES` in `cut-rules.ts`:
 *
 * 1. **Reorder within a day** so a dependent event follows its "after" target
 *    when both landed on the same day. Free — nothing moves between days, so
 *    this is applied silently.
 * 2. **Solve across days** — propose moving an event to a different day in the
 *    same week so a relational or temporal constraint is satisfied. These are
 *    never applied silently: they surface as proposals the dialog asks the user
 *    to accept or reject, because the user mapped those days deliberately.
 *
 * Capacity outranks constraints (`capacityOutranksConstraints`): a proposal
 * that would push a day past its working window is discarded before it is ever
 * shown, since the cut may not place anything outside working hours.
 *
 * Cross-week moves are deliberately out of scope — a constraint that can only
 * be satisfied by moving between weeks is reported as a violation instead.
 */

export type ConstraintEntity = {
    /** Event id, or module id for a module-owned constraint. */
    id: string;
    title: string;
    constraints: Array<GanttConstraint>;
};

/** Where an event currently sits, in the linear day timeline. */
export type ConstraintPlacement = {
    eventId: string;
    moduleId: null | string;
    dayId: string;
    /** Index of the day in the flattened week→day timeline. */
    dayOrdinal: number;
    dayIndex: GanttDayIndex;
    weekId: string;
    durationMinutes: number;
};

export type ConstraintDayInfo = {
    id: string;
    dayIndex: GanttDayIndex;
    weekId: string;
    dayOrdinal: number;
    capacityMinutes: number;
    /** Minutes already committed on this day. */
    loadMinutes: number;
};

/** A cross-day move the solver would like to make, pending user approval. */
export type ConstraintMoveProposal = {
    eventId: string;
    eventTitle: string;
    fromDayId: string;
    toDayId: string;
    /** The constraint this move satisfies, in human terms. */
    reason: string;
};

/** A constraint that no legal placement can satisfy. */
export type ConstraintViolation = {
    ownerId: string;
    ownerTitle: string;
    constraintId: string;
    kind: "relational" | "temporal";
    /** Hebrew explanation of what could not be satisfied. */
    reason: string;
};

export type ConstraintPassInput = {
    placements: Array<ConstraintPlacement>;
    days: Record<string, ConstraintDayInfo>;
    /** Constraints owned by events and modules, indexed by owner id. */
    entities: Array<ConstraintEntity>;
    /** Module id → the event ids it contains, for module-level constraints. */
    eventIdsByModule: Record<string, Array<string>>;
    /** Display titles for events, used in violation messages. */
    titleByEventId: Record<string, string>;
};

export type ConstraintPassResult = {
    proposals: Array<ConstraintMoveProposal>;
    violations: Array<ConstraintViolation>;
};

/** Every event a constraint owner resolves to (a module fans out to its events). */
function ownedEventIds(
    constraint: GanttConstraint,
    eventIdsByModule: Record<string, Array<string>>,
): Array<string> {
    if (constraint.ownerType === "event") return [constraint.ownerEventId];
    return eventIdsByModule[constraint.ownerModuleId] ?? [];
}

/** Every event a relational constraint's target resolves to. */
function targetEventIds(
    constraint: RelationalConstraint,
    eventIdsByModule: Record<string, Array<string>>,
): Array<string> {
    return constraint.targetType === "module"
        ? eventIdsByModule[constraint.targetId] ?? []
        : [constraint.targetId];
}

/** Weekdays a temporal constraint permits. */
function allowedDayIndices(
    constraint: TemporalConstraint,
): Set<GanttDayIndex> {
    const base =
        constraint.allowedDays && constraint.allowedDays.length > 0
            ? new Set(constraint.allowedDays)
            : new Set<GanttDayIndex>([0, 1, 2, 3, 4, 5, 6] as Array<GanttDayIndex>);
    for (const forbidden of constraint.forbiddenDays ?? []) base.delete(forbidden);
    for (const never of NEVER_SCHEDULE_DAY_INDICES) base.delete(never);
    return base;
}

/**
 * Days in the same week that could hold `placement`, honouring capacity.
 * Ordered by proximity to where the event already sits, so the solver makes
 * the smallest move that works.
 */
function feasibleDays(
    placement: ConstraintPlacement,
    days: Record<string, ConstraintDayInfo>,
    accept: (day: ConstraintDayInfo) => boolean,
): Array<ConstraintDayInfo> {
    return Object.values(days)
        .filter((day) => day.weekId === placement.weekId)
        .filter((day) => !NEVER_SCHEDULE_DAY_INDICES.includes(day.dayIndex))
        .filter((day) =>
            CONSTRAINT_RULES.capacityOutranksConstraints
                ? day.loadMinutes + placement.durationMinutes <= day.capacityMinutes
                : true,
        )
        .filter(accept)
        .sort(
            (a, b) =>
                Math.abs(a.dayOrdinal - placement.dayOrdinal) -
                Math.abs(b.dayOrdinal - placement.dayOrdinal),
        );
}

/**
 * Run the constraint solver over an already-balanced placement map.
 *
 * Returns proposals (never applied here — the caller decides) and violations.
 * The pass is idempotent and side-effect free; `maxSolverPasses` bounds it so a
 * cyclic constraint graph terminates instead of spinning.
 */
export function solveConstraints(
    input: ConstraintPassInput,
): ConstraintPassResult {
    const proposals: Array<ConstraintMoveProposal> = [];
    const violations: Array<ConstraintViolation> = [];

    const placementByEvent = new Map(
        input.placements.map((placement) => [placement.eventId, placement]),
    );
    // Working copy of day load so successive proposals do not all target the
    // same slack.
    const days: Record<string, ConstraintDayInfo> = Object.fromEntries(
        Object.entries(input.days).map(([id, day]) => [id, { ...day }]),
    );

    const titleOf = (eventId: string): string =>
        input.titleByEventId[eventId] ?? eventId;

    const propose = (
        placement: ConstraintPlacement,
        target: ConstraintDayInfo,
        reason: string,
    ) => {
        days[placement.dayId].loadMinutes -= placement.durationMinutes;
        target.loadMinutes += placement.durationMinutes;
        proposals.push({
            eventId: placement.eventId,
            eventTitle: titleOf(placement.eventId),
            fromDayId: placement.dayId,
            toDayId: target.id,
            reason,
        });
        placement.dayId = target.id;
        placement.dayOrdinal = target.dayOrdinal;
        placement.dayIndex = target.dayIndex;
    };

    for (let pass = 0; pass < CONSTRAINT_RULES.maxSolverPasses; pass++) {
        let changed = false;

        for (const entity of input.entities) {
            for (const constraint of entity.constraints) {
                for (const eventId of ownedEventIds(
                    constraint,
                    input.eventIdsByModule,
                )) {
                    const placement = placementByEvent.get(eventId);
                    if (!placement) continue;

                    const outcome =
                        constraint.type === ConstraintType.Temporal
                            ? applyTemporal(constraint, placement, days, propose)
                            : applyRelational(
                                constraint,
                                placement,
                                placementByEvent,
                                days,
                                input.eventIdsByModule,
                                propose,
                                titleOf,
                            );

                    if (outcome === "moved") changed = true;
                    if (outcome !== "violated" || pass > 0) continue;

                    violations.push({
                        ownerId: entity.id,
                        ownerTitle: entity.title,
                        constraintId: constraint.id,
                        kind:
                            constraint.type === ConstraintType.Temporal
                                ? "temporal"
                                : "relational",
                        reason:
                            constraint.type === ConstraintType.Temporal
                                ? `לא נמצא יום מותר בשבוע עבור "${titleOf(eventId)}" שעומד באילוץ הימים`
                                : `לא ניתן לסדר את "${titleOf(eventId)}" ביחס ליעד האילוץ בתוך אותו שבוע`,
                    });
                }
            }
        }

        if (!changed) break;
    }

    return { proposals, violations };
}

type SolveOutcome = "moved" | "satisfied" | "violated";

/** Satisfy a temporal (allowed/forbidden weekday) constraint. */
function applyTemporal(
    constraint: TemporalConstraint,
    placement: ConstraintPlacement,
    days: Record<string, ConstraintDayInfo>,
    propose: (
        placement: ConstraintPlacement,
        target: ConstraintDayInfo,
        reason: string,
    ) => void,
): SolveOutcome {
    const allowed = allowedDayIndices(constraint);
    if (allowed.has(placement.dayIndex)) return "satisfied";
    if (!CONSTRAINT_RULES.solveAcrossDays) return "violated";

    const [target] = feasibleDays(placement, days, (day) =>
        allowed.has(day.dayIndex),
    );
    if (!target) return "violated";

    propose(placement, target, "אילוץ יום בשבוע");
    return "moved";
}

/** Satisfy a relational (after/before, with day-delay bounds) constraint. */
function applyRelational(
    constraint: RelationalConstraint,
    placement: ConstraintPlacement,
    placementByEvent: Map<string, ConstraintPlacement>,
    days: Record<string, ConstraintDayInfo>,
    eventIdsByModule: Record<string, Array<string>>,
    propose: (
        placement: ConstraintPlacement,
        target: ConstraintDayInfo,
        reason: string,
    ) => void,
    titleOf: (eventId: string) => string,
): SolveOutcome {
    const targets = targetEventIds(constraint, eventIdsByModule)
        .map((id) => placementByEvent.get(id))
        .filter((entry): entry is ConstraintPlacement => Boolean(entry));
    if (targets.length === 0) return "satisfied";

    // "after" must clear the last target; "before" must precede the first.
    const anchor =
        constraint.relation === "after"
            ? Math.max(...targets.map((entry) => entry.dayOrdinal))
            : Math.min(...targets.map((entry) => entry.dayOrdinal));

    const minDelay = constraint.minDelayDays ?? 0;
    const maxDelay = constraint.maxDelayDays;

    const satisfies = (ordinal: number): boolean => {
        const delta =
            constraint.relation === "after" ? ordinal - anchor : anchor - ordinal;
        if (delta < minDelay) return false;
        if (maxDelay !== undefined && delta > maxDelay) return false;
        return true;
    };

    if (satisfies(placement.dayOrdinal)) return "satisfied";
    if (!CONSTRAINT_RULES.solveAcrossDays) return "violated";

    const [target] = feasibleDays(placement, days, (day) =>
        satisfies(day.dayOrdinal),
    );
    if (!target) return "violated";

    propose(
        placement,
        target,
        `אילוץ "${constraint.relation === "after" ? "אחרי" : "לפני"}" מול ${titleOf(
            targets[0].eventId,
        )}`,
    );
    return "moved";
}
