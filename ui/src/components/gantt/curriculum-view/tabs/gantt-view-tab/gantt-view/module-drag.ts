import { GanttDayId, GanttEventId } from "@/api-shared/types/gantt/models";

type EventPlacement = {
    eventIds: Array<GanttEventId>;
    eventMappings: Record<string, GanttDayId>;
};

/** One of a module's mappings; `eventId` null for a module-level mapping. */
export type ModuleMapping = { eventId: GanttEventId | null; dayId: GanttDayId };
export type MappingMove = { eventId: GanttEventId | null; from: GanttDayId; to: GanttDayId };

/**
 * A רצף זמן module block is draggable only while every event is either
 * unallocated or mapped inside the timeline. One event outside it would be
 * left behind (or torn off) by a relative move.
 */
export function canDragModule(
    { eventIds, eventMappings }: EventPlacement,
    linearDays: Array<GanttDayId>,
): boolean {
    const inRange = new Set(linearDays);
    return eventIds.every((eId) => !eventMappings[eId] || inRange.has(eventMappings[eId]));
}

/** Mapping a fully unallocated module to a day places every event on that day. */
export function planModuleMap({ eventIds, eventMappings }: EventPlacement): Array<GanttEventId> {
    return eventIds.filter((eId) => !eventMappings[eId]);
}

/**
 * The mappings that place a module: its allocated events, or — for an
 * event-less module only — its module-level mappings.
 */
export function moduleMappingsOf(
    { eventIds, eventMappings }: EventPlacement,
    moduleDayIds: Array<GanttDayId>,
): Array<ModuleMapping> {
    if (eventIds.length === 0) return moduleDayIds.map((dayId) => ({ eventId: null, dayId }));
    return eventIds
        .filter((eId) => eventMappings[eId])
        .map((eventId) => ({ eventId, dayId: eventMappings[eventId] }));
}

/**
 * Moves every mapping by `deltaDays`, keeping their relative spacing.
 * All-or-nothing: `null` when any would leave the timeline. Ordered leading
 * edge first, so no move lands on a day a sibling still occupies.
 */
export function planModuleShift(
    mappings: Array<ModuleMapping>,
    linearDays: Array<GanttDayId>,
    deltaDays: number,
): Array<MappingMove> | null {
    if (deltaDays === 0) return [];
    const moves: Array<MappingMove & { idx: number }> = [];
    for (const { eventId, dayId: from } of mappings) {
        const idx = linearDays.indexOf(from);
        const to = linearDays[idx + deltaDays];
        if (idx === -1 || !to) return null;
        moves.push({ eventId, from, to, idx });
    }
    moves.sort((a, b) => (deltaDays > 0 ? b.idx - a.idx : a.idx - b.idx));
    return moves.map(({ eventId, from, to }) => ({ eventId, from, to }));
}
