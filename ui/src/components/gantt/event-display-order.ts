/**
 * Name: event-display-order.ts
 * Purpose: The order a module's events are listed in. The module dialog and
 *   the timeline both use it, so the order set by dragging rows in the dialog
 *   is the order the timeline shows (#850).
 * Created: 2026-10-03
 * Author: Michael K. Steinberg
 */
import { GanttEvent, GanttEventId } from "@/api-shared/types/gantt/models";

/** A lone event, or a whole event group with its members in order. */
export type EventDisplayBlock = {
    groupId?: string;
    ids: Array<GanttEventId>;
};

/**
 * Splits `eventIds` (the module's saved order) into top-level blocks: a
 * group sits where its first member is, with every member gathered under it.
 */
export function groupEventBlocks(
    eventIds: ReadonlyArray<GanttEventId>,
    events: Readonly<Record<string, Pick<GanttEvent, "groupId"> | undefined>>,
): Array<EventDisplayBlock>
{
    const blocks: Array<EventDisplayBlock> = [];
    const byGroup = new Map<string, EventDisplayBlock>();
    for (const eventId of eventIds)
    {
        const groupId = events[ eventId ]?.groupId ?? undefined;
        const existing = groupId ? byGroup.get(groupId) : undefined;
        if (existing)
        {
            existing.ids.push(eventId);
            continue;
        }
        const block: EventDisplayBlock = groupId
            ? { groupId, ids: [ eventId ] }
            : { ids: [ eventId ] };
        if (groupId) byGroup.set(groupId, block);
        blocks.push(block);
    }
    return blocks;
}

/** The module's events, flattened in the order the dialog lists them. */
export function eventDisplayOrder(
    eventIds: ReadonlyArray<GanttEventId>,
    events: Readonly<Record<string, Pick<GanttEvent, "groupId"> | undefined>>,
): Array<GanttEventId>
{
    return groupEventBlocks(eventIds, events).flatMap((block) => block.ids);
}
