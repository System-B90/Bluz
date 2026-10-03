/**
 * Name: drop-warning.ts
 * Purpose: Says, while a bar is still being dragged, what dropping it on the
 *   hovered cell would break, so the cell can warn before the drop instead
 *   of a violation showing up after it (#811). Shuffle-alignment checks are
 *   tracked separately (#830 follow-up).
 * Created: 2026-10-03
 * Author: Michael K. Steinberg
 */
import { GanttConstraint, GanttDayIndex } from "@/api-shared/types/gantt/models";
import { planModuleMap } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/module-drag";
import { temporalViolationsAt } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-violations";

export const SHIFT_OFF_TIMELINE = "לא ניתן להזיז — מופעים יחרגו מסוף הציר";

type Constrained = { constraints?: Array<Pick<GanttConstraint, "id">> } | undefined;

export type DropWarningSources = {
    constraints: Readonly<Record<string, GanttConstraint | undefined>>;
    modules: Readonly<Record<string, (Constrained & { events?: Array<string> }) | undefined>>;
    events: Readonly<Record<string, Constrained>>;
    days: Readonly<Record<string, { dayIndex: GanttDayIndex } | undefined>>;
    eventMappings: Record<string, string>;
    linearDays: ReadonlyArray<string>;
    /** Null when the shift would push an event off the timeline. */
    planShift: (moduleId: string, deltaDays: number) => Array<{ eventId: null | string; to: string }> | null;
};

type DragData = Record<string, unknown> | undefined;

/** The reason not to drop `payload` on `target`, or null when it is fine. */
export function dropWarningFor(
    payload: DragData,
    target: DragData,
    sources: DropWarningSources,
): null | string
{
    if (!payload || !target || target.targetType === "remove") return null;
    const dayId = target.dayId as string | undefined;
    if (!dayId) return null;

    const moduleId = payload.moduleId as string;
    const placements: Array<{ entity: Constrained; dayId: string }> = [];
    const moduleAt = (day: string) => placements.push({ entity: sources.modules[ moduleId ], dayId: day });
    const eventAt = (eventId: null | string, day: string) =>
    {
        if (eventId) placements.push({ entity: sources.events[ eventId ], dayId: day });
    };

    switch (payload.type)
    {
    case "module-shift": {
        const delta = sources.linearDays.indexOf(dayId)
            - sources.linearDays.indexOf(payload.sourceDayId as string);
        if (delta === 0) return null;
        const moves = sources.planShift(moduleId, delta);
        if (!moves) return SHIFT_OFF_TIMELINE;
        moduleAt(dayId);
        moves.forEach((m) => eventAt(m.eventId, m.to));
        break;
    }
    case "module-move":
        moduleAt(dayId);
        break;
    case "module-map":
        moduleAt(dayId);
        planModuleMap({
            eventIds: sources.modules[ moduleId ]?.events ?? [],
            eventMappings: sources.eventMappings,
        }).forEach((eventId) => eventAt(eventId, dayId));
        break;
    case "event-map":
    case "event-move":
        eventAt(payload.eventId as string, dayId);
        break;
    default:
        return null;
    }

    const broken = new Set<string>();
    for (const { entity, dayId: day } of placements)
    {
        const dayIndex = sources.days[ day ]?.dayIndex;
        if (dayIndex === undefined || !entity?.constraints) continue;
        temporalViolationsAt(
            entity.constraints.map((c) => sources.constraints[ c.id ]),
            dayIndex,
        ).forEach((reason) => broken.add(reason));
    }
    return broken.size > 0 ? [ ...broken ].join(" · ") : null;
}
