import dayjs from "dayjs";
import type { SlotInfo } from "react-big-calendar";

import { resourceKeyToResolvable } from "@/api-shared/types/room";
import { Event } from "@/components/schedule/types/event";
import { copyableFields } from "@/components/schedule/types/EventUtils";

export const DUMMY_ROOM_ID = "no-room-unassigned";

/** Where a paste lands: a grid slot, optionally inside a day-view room column. */
export type PasteSlot = {
    start: Date;
    resourceId?: SlotInfo["resourceId"];
};

/**
 * The new event a paste creates (shared by Ctrl+V and the right-click menus,
 * #859). It keeps the copied event's duration; with a slot it starts there and
 * takes the slot's room column, without one it lands 30 minutes after the
 * original so the copy never hides exactly under it.
 * @param copied The event on the clipboard.
 * @param slot The target slot, or null.
 */
export function pastedEventFrom(copied: Event, slot: null | PasteSlot): Event {
    const originalStart = dayjs(copied.startTime);
    const duration = dayjs(copied.endTime).diff(originalStart, "minute");
    const start = slot ? dayjs(slot.start) : originalStart.add(30, "minute");

    let rooms = copied.rooms;
    if (slot?.resourceId) {
        const room = resourceKeyToResolvable(slot.resourceId.toString());
        rooms = room.id === DUMMY_ROOM_ID ? [] : [ room ];
    }

    return {
        ...copyableFields(copied),
        startTime: start,
        endTime: start.add(duration, "minute"),
        rooms,
    } as Event;
}
