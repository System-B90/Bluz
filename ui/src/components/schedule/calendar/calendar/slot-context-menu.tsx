"use client";
import type { MouseEvent as ReactMouseEvent, PropsWithChildren, ReactElement } from "react";
import { cloneElement, isValidElement } from "react";

import { PasteSlot } from "@/components/schedule/calendar/calendar/paste";
import { useSplitCalendar } from "@/components/schedule/calendar/split/SplitCalendarContext";

/** Right-click on an empty grid slot, in viewport coordinates (#859). */
export type OpenSlotContextMenu = (slot: PasteSlot, clientX: number, clientY: number) => void;

const SLOT_START_ATTR = "data-slot-start";
const SLOT_RESOURCE_ATTR = "data-slot-resource";

/**
 * react-big-calendar `timeSlotWrapper`: stamps each slot with its start time
 * and room column so a right-click can be resolved to a paste target. Events
 * are drawn in an overlay above the slots, so the slot is found by position
 * ({@link slotUnderPointer}) rather than by the click's own target.
 */
export function CalendarTimeSlotWrapper({
    children,
    value,
    resource,
}: PropsWithChildren<{ value?: Date; resource?: number | string }>) {
    // rbc types its slot wrapper as a prop-less component, though it always
    // passes `value` (and `resource` in the day view).
    const { slotContextMenuEnabled } = useSplitCalendar();
    if (!slotContextMenuEnabled || !value || !isValidElement(children)) return children;
    return cloneElement(children as ReactElement<Record<string, unknown>>, {
        [ SLOT_START_ATTR ]: value.getTime(),
        [ SLOT_RESOURCE_ATTR ]: resource ?? undefined,
    });
}

/**
 * The grid slot under the pointer, or null outside a day column (the time
 * gutter, headers, all-day row).
 * @param clientX Pointer x in viewport coordinates.
 * @param clientY Pointer y in viewport coordinates.
 * @param root Document to search; injectable for tests.
 */
export function slotUnderPointer(clientX: number, clientY: number, root: Document = document): null | PasteSlot {
    for (const element of root.elementsFromPoint(clientX, clientY)) {
        const raw = element.getAttribute(SLOT_START_ATTR);
        if (raw === null || !element.closest(".rbc-day-slot")) continue;
        const resource = element.getAttribute(SLOT_RESOURCE_ATTR);
        return { start: new Date(Number(raw)), resourceId: resource ?? undefined };
    }
    return null;
}

/**
 * `onContextMenu` for the grid: opens the slot menu on empty grid, leaves the
 * browser's own menu everywhere else. Tiles stop propagation themselves.
 * @param open The slot menu opener; null while the calendar is read-only.
 */
export function slotContextMenuHandler(open: null | OpenSlotContextMenu) {
    return (pointer: ReactMouseEvent<HTMLElement>) => {
        if (!open) return;
        const slot = slotUnderPointer(pointer.clientX, pointer.clientY);
        if (!slot) return;
        pointer.preventDefault();
        open(slot, pointer.clientX, pointer.clientY);
    };
}
