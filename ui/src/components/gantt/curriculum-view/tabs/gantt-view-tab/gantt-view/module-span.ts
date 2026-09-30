import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { getRecurrenceOccurrenceDayIds } from "@/api-shared/gantt/recurrence";
import { EventRecurrence, getAllowedDayIndices } from "@/api-shared/types/gantt/models";
import { EventDaySpan } from "@/components/gantt/curriculum-view/gantt-time-utils";

type CurriculumState = Pick<NormalizedStore, "days" | "events">;
type ModuleSpanInput = {
    eventIds: Array<string>;
    /** Module-level (event-less) mappings. Only used when the module has no events. */
    moduleDayIds: Array<string>;
    eventMappings: Record<string, string>;
    eventSpans: Record<string, EventDaySpan>;
    exceptions: Record<string, { eventId: string; dayId: string }>;
    linearDays: Array<string>;
} & CurriculumState;

/**
 * Every day a module's block may cover. A module with events spans only the
 * days its allocated events actually occupy — start day, week-split parts and
 * surviving recurrence occurrences — so the block runs first event → last
 * event and never covers time holding none of them. Stale module-level
 * mappings are ignored then; they only place an event-less module.
 */
export function getModuleSpanDayIds({
    eventIds,
    moduleDayIds,
    eventMappings,
    eventSpans,
    exceptions,
    linearDays,
    events,
    days,
}: ModuleSpanInput): Set<string> {
    if (eventIds.length === 0) return new Set(moduleDayIds);

    const dayIds = new Set<string>();
    eventIds.forEach((eId) => {
        const startDayId = eventMappings[eId];
        if (!startDayId) return;
        dayIds.add(startDayId);
        eventSpans[eId]?.dayIds.forEach((d) => dayIds.add(d));

        const recurrence = events[eId]?.recurrence ?? EventRecurrence.None;
        if (recurrence === EventRecurrence.None) return;

        const excludedDayIds = new Set<string>();
        Object.values(exceptions).forEach((ex) => {
            if (ex.eventId === eId) excludedDayIds.add(ex.dayId);
        });

        getRecurrenceOccurrenceDayIds({
            recurrence,
            startDayId,
            linearDays,
            dayIndexOf: (d) => days[d]?.dayIndex,
            excludedDayIds,
            allowedDayIndices: getAllowedDayIndices(events[eId]?.constraints),
        }).forEach((d) => dayIds.add(d));
    });
    return dayIds;
}
