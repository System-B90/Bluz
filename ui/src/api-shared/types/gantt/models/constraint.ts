import { GanttDayIndex } from "@/api-shared/types/gantt/models/day";
import { GanttEventId } from "@/api-shared/types/gantt/models/event";
import { GanttModuleId } from "@/api-shared/types/gantt/models/module";

export enum ConstraintType {
    Relational = "RELATIONAL",
    Temporal = "TEMPORAL",
}

export type EntityType = "event" | "module";

export type BaseConstraint =
    | {
          id: string;
          type: ConstraintType;
          ownerEventId: GanttEventId;
          ownerModuleId?: GanttModuleId | undefined;
          ownerType: "event";
      }
    | {
          id: string;
          type: ConstraintType;
          ownerEventId?: GanttEventId | undefined;
          ownerModuleId: GanttModuleId;
          ownerType: "module";
      };

/**
 * Handles dependencies between two entities (Event-Event, Module-Module, Mixed).
 */
export type RelationalConstraint = BaseConstraint & {
    type: ConstraintType.Relational;
    targetId: GanttEventId | GanttModuleId; // ID of the referenced GanttEvent or GanttModule
    targetType: EntityType;
    relation: "after" | "before";
    minDelayDays?: number; // "at least N days after"
    maxDelayDays?: number; // "no more than N days after"
};

/**
 * Handles fixed calendar and day-of-week constraints.
 */
export type TemporalConstraint = BaseConstraint & {
    type: ConstraintType.Temporal;
    allowedDays?: Array<GanttDayIndex>; // e.g., "must be on Tuesday"
    forbiddenDays?: Array<GanttDayIndex>; // e.g., "must not be on Sunday"
};

export type GanttConstraint = RelationalConstraint | TemporalConstraint;

const ALL_DAY_INDICES: Array<GanttDayIndex> = [
    GanttDayIndex.Sunday,
    GanttDayIndex.Monday,
    GanttDayIndex.Tuesday,
    GanttDayIndex.Wednesday,
    GanttDayIndex.Thursday,
    GanttDayIndex.Friday,
    GanttDayIndex.Saturday,
];

/**
 * Weekdays a set of temporal constraints permits: intersects every
 * `allowedDays`, then subtracts every `forbiddenDays`. `null` means
 * unrestricted (no temporal constraints) — recurrence echoing and other
 * callers should skip filtering entirely rather than treat it as "no days
 * allowed".
 */
export function getAllowedDayIndices(
    constraints: Array<GanttConstraint | undefined> | undefined,
): Set<GanttDayIndex> | null {
    const temporal = (constraints ?? []).filter(
        (c): c is TemporalConstraint => c?.type === ConstraintType.Temporal,
    );
    if (temporal.length === 0) return null;

    let allowed = new Set<GanttDayIndex>(ALL_DAY_INDICES);
    for (const constraint of temporal) {
        if (constraint.allowedDays && constraint.allowedDays.length > 0) {
            allowed = new Set(
                [...allowed].filter((day) =>
                    constraint.allowedDays?.includes(day) ?? false,
                ),
            );
        }
    }
    for (const constraint of temporal) {
        for (const day of constraint.forbiddenDays ?? []) {
            allowed.delete(day);
        }
    }
    return allowed;
}

/**
 * Detects mutually conflicting temporal constraints (issue #104): intersects
 * all `allowedDays`, subtracts all `forbiddenDays`, and reports a conflict
 * when no valid day of the week remains. Warning-level only — saving is
 * never blocked by this check.
 */
export function hasConflictingTemporalConstraints(
    constraints: Array<GanttConstraint | undefined>,
): boolean {
    const temporal = constraints.filter(
        (c): c is TemporalConstraint => c?.type === ConstraintType.Temporal,
    );
    if (temporal.length === 0) return false;

    let allowed = new Set<GanttDayIndex>(ALL_DAY_INDICES);
    for (const constraint of temporal) {
        if (constraint.allowedDays && constraint.allowedDays.length > 0) {
            allowed = new Set(
                [...allowed].filter((day) =>
                    constraint.allowedDays?.includes(day) ?? false,
                ),
            );
        }
    }
    for (const constraint of temporal) {
        for (const day of constraint.forbiddenDays ?? []) {
            allowed.delete(day);
        }
    }
    return allowed.size === 0;
}

type ConstraintDisplayState = {
    modules: Record<GanttModuleId, { title: string }>;
    events: Record<GanttEventId, { title: string }>;
};

export function constraintToHumanReadableString(
    constraint: GanttConstraint,
    state: ConstraintDisplayState,
) {
    if (constraint.type === ConstraintType.Relational) {
        const target =
            constraint.targetType === "module"
                ? state.modules[constraint.targetId]
                : state.events[constraint.targetId];

        if (!target) return "*לא נמצא היעד*";

        const ownerTypeName =
            constraint.ownerType === "event" ? "המופע" : "המערך";
        const targetTypeName =
            constraint.targetType === "module" ? "המערך" : "המופע";

        let ownerName = " ";
        if (constraint.ownerType === "event") {
            ownerName = state.events[constraint.ownerEventId].title;
        } else {
            ownerName = state.modules[constraint.ownerModuleId].title;
        }

        if (constraint.relation === "after") {
            return `${ownerTypeName} ${ownerName} יתחיל אחרי ש${targetTypeName} ${constraint.targetId} יסתיים`;
        } else if (constraint.relation === "before") {
            return `${ownerTypeName} ${ownerName} יסתיים לפני ש${targetTypeName} ${constraint.targetId} יתחיל`;
        }
    } else {
        return "[___]";
    }
}
