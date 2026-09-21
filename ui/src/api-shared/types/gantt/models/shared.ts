export type BaseGantItem = {
    readonly id: string;
    title: string;
};

/**
 * Split out of `event.ts` so `constraint.ts` (which an event's own
 * `constraints` field references) can depend on the id type without the two
 * files importing each other.
 */
export type GanttEventId = BaseGantItem["id"];

/**
 * Split out of `module.ts` for the same reason as {@link GanttEventId}:
 * `constraint.ts` needs the id type and `module.ts` needs `GanttConstraint`.
 */
export type GanttModuleId = BaseGantItem["id"];
