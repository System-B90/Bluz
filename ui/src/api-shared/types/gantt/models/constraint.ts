import { GanttDayIndex } from "@/api-shared/types/gantt/models/day";
import {
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models/shared";

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

function filterTemporalConstraints(
    constraints: Array<GanttConstraint | undefined>,
): Array<TemporalConstraint> {
    return constraints.filter(
        (c): c is TemporalConstraint => c?.type === ConstraintType.Temporal,
    );
}

/**
 * Intersects every `allowedDays` across the given temporal constraints, then
 * subtracts every `forbiddenDays`. Shared by {@link getAllowedDayIndices} and
 * {@link hasConflictingTemporalConstraints}, which both reduce to this same
 * intersect-then-subtract pass over the same day-of-week domain.
 */
function intersectAllowedDayIndices(
    temporal: Array<TemporalConstraint>,
): Set<GanttDayIndex> {
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
 * Weekdays a set of temporal constraints permits: intersects every
 * `allowedDays`, then subtracts every `forbiddenDays`. `null` means
 * unrestricted (no temporal constraints) — recurrence echoing and other
 * callers should skip filtering entirely rather than treat it as "no days
 * allowed".
 */
export function getAllowedDayIndices(
    constraints: Array<GanttConstraint | undefined> | undefined,
): null | Set<GanttDayIndex> {
    const temporal = filterTemporalConstraints(constraints ?? []);
    if (temporal.length === 0) return null;
    return intersectAllowedDayIndices(temporal);
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
    const temporal = filterTemporalConstraints(constraints);
    if (temporal.length === 0) return false;
    return intersectAllowedDayIndices(temporal).size === 0;
}

export type ConstraintDisplayState = {
    syllabuses: Record<string, { title: string }>;
    modules: Record<GanttModuleId, { title: string; syllabusId: string }>;
    events: Record<GanttEventId, { title: string; moduleId: GanttModuleId }>;
};

const NOT_FOUND = "*לא נמצא*";
const PATH_SEPARATOR = " › ";

/**
 * Fully qualified name of a constraint endpoint: "syllabus › module" for a
 * module, "syllabus › module › event" for an event. Missing ancestors are
 * dropped; a missing entity itself reads as "not found".
 */
export function qualifiedEntityName(
    type: EntityType,
    id: string,
    state: ConstraintDisplayState,
): string {
    const event = type === "event" ? state.events[id as GanttEventId] : undefined;
    if (type === "event" && !event) return NOT_FOUND;
    const moduleId = event ? event.moduleId : (id as GanttModuleId);
    const ganttModule = state.modules[moduleId];
    if (type === "module" && !ganttModule) return NOT_FOUND;
    const syllabus = ganttModule && state.syllabuses[ganttModule.syllabusId];
    return [syllabus?.title, ganttModule?.title, event?.title]
        .filter((part): part is string => !!part)
        .join(PATH_SEPARATOR);
}

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

        const ownerName = qualifiedEntityName(
            constraint.ownerType,
            constraint.ownerType === "event"
                ? constraint.ownerEventId
                : constraint.ownerModuleId,
            state,
        );
        const targetName = qualifiedEntityName(
            constraint.targetType,
            constraint.targetId,
            state,
        );

        if (constraint.relation === "after") {
            return `${ownerTypeName} ${ownerName} יתחיל אחרי ש${targetTypeName} ${targetName} יסתיים`;
        } else if (constraint.relation === "before") {
            return `${ownerTypeName} ${ownerName} יסתיים לפני ש${targetTypeName} ${targetName} יתחיל`;
        }
    } else {
        return "[___]";
    }
}
