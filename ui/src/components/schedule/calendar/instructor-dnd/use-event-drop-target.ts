"use client";
import { useDroppable } from "@dnd-kit/core";

import { useInstructorDnd } from "@/components/schedule/calendar/instructor-dnd/InstructorDndProvider";
import { eventDroppableId } from "@/components/schedule/calendar/instructor-dnd/types";
import { Event } from "@/components/schedule/types/event";

/**
 * Registers a calendar event as a drop target for instructor drags.
 * Registration is skipped for react-big-calendar's drag preview clones and for
 * locked events, which cannot take assignments anyway.
 *
 * @param event The event being rendered.
 * @param enabled Whether this render should accept drops.
 * @returns The droppable ref plus whether a drop here is currently armed.
 */
export function useEventDropTarget(event: Event, enabled: boolean) {
    const { activeDrag } = useInstructorDnd();
    const { setNodeRef, isOver } = useDroppable({
        id: eventDroppableId(event.id),
        disabled: !enabled || event.locked,
        data: { kind: "event", event },
    });

    return {
        setDropRef: setNodeRef,
        isDropTarget: Boolean(activeDrag) && !event.locked && enabled,
        isOver: isOver && Boolean(activeDrag),
    };
}
