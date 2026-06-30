import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { ConstraintType, RelationalConstraint } from "@/api-shared/types/gantt/models/constraint";

/**
 * Derives read-only sibling ordering constraints from the event's position
 * in the module's event list. These are never persisted — they reflect the
 * current ordering and should update when events are reordered.
 */
export function buildVirtualSiblingConstraints(
    eventId: GanttEventId,
    moduleId: GanttModuleId,
    moduleEvents: Array<GanttEventId>,
): Array<RelationalConstraint> {
    const index = moduleEvents.indexOf(eventId);
    if (index === -1) return [];

    const result: Array<RelationalConstraint> = [];
    const prevId = index > 0 ? moduleEvents[index - 1] : undefined;
    const nextId = index < moduleEvents.length - 1 ? moduleEvents[index + 1] : undefined;

    if (prevId) {
        result.push({
            id: `virtual-after-${prevId}`,
            type: ConstraintType.Relational,
            ownerType: "event",
            ownerEventId: eventId,
            targetType: "event",
            targetId: prevId,
            relation: "after",
        });
    }
    if (nextId) {
        result.push({
            id: `virtual-before-${nextId}`,
            type: ConstraintType.Relational,
            ownerType: "event",
            ownerEventId: eventId,
            targetType: "event",
            targetId: nextId,
            relation: "before",
        });
    }
    return result;
}
