import dayjs from "dayjs";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SlotInfo } from "react-big-calendar";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";

import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { ResolvableRoom, resourceKeyToResolvable } from "@/api-shared/types/room";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { Event } from "@/components/schedule/types/event";

const DUMMY_ROOM_ID = "no-room-unassigned";

/**
 * Custom React hook to manage calendar event logic, user interactions (e.g. drag & drop, select, click),
 * and keyboard shortcuts (copy, paste, delete).
 * 
 * @param events - The current list of calendar events.
 * @param handleSaveEvent - Callback when saving an event.
 * @param handleDeleteEvent - Callback when deleting an event.
 * @param setSelectedEvent - State setter to select an event.
 * @param setOpenEventDialog - State setter to open/close the event dialog.
 * @returns State and event handlers for the calendar.
 */
export function useCalendarHandlers(
    events: Array<Event>,
    handleSaveEvent: (event: Event, initiator?: EventChangeInitiator) => void,
    handleDeleteEvent: (
        eventId: Event["id"],
        initiator?: EventChangeInitiator,
    ) => void,
    setSelectedEvent: (event: Partial<Event> | undefined) => void,
    setOpenEventDialog: (open: boolean) => void,
) {
    const { filteredInstructors, filteredCourses } = useCalendarFilters();

    const [activeEvent, setActiveEvent] = useState<Event | null>(null);
    const [copiedEvent, setCopiedEvent] = useState<Event | null>(null);
    const [selectedSlotInfo, setSelectedSlotInfo] = useState<{
        start: Date;
        resourceId?: SlotInfo["resourceId"];
    } | null>(null);

    const copyPasteData = useRef({
        activeEvent,
        copiedEvent,
        selectedSlotInfo,
    });

    useEffect(() => {
        copyPasteData.current = { activeEvent, copiedEvent, selectedSlotInfo };
    }, [activeEvent, copiedEvent, selectedSlotInfo]);

    // react-big-calendar's drag addon doesn't forward modifier keys to
    // onEventDrop, so we track Ctrl/Cmd ourselves for Ctrl+Drag duplication
    // (#575). Escape-to-cancel is already handled by the library itself
    // (it aborts the drag before onEventDrop ever fires).
    const ctrlHeldRef = useRef(false);
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Control" || e.key === "Meta") ctrlHeldRef.current = true;
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Control" || e.key === "Meta") ctrlHeldRef.current = false;
        };
        const onBlur = () => {
            ctrlHeldRef.current = false;
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", onBlur);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", onBlur);
        };
    }, []);

    const handleEventDrag = useCallback(
        (
            changes: EventInteractionArgs<Event>,
            interaction: "move" | "resize" = "move",
        ): void => {
            if (changes.event.locked) return;

            const roomId: null | ResolvableRoom = changes.resourceId
                ? resourceKeyToResolvable(changes.resourceId.toString())
                : null;

            let newRooms = changes.event.rooms;
            if (roomId) {
                if (roomId.id === DUMMY_ROOM_ID) {
                    newRooms = [];
                } else if (changes.event.rooms.length <= 1) {
                    newRooms = [roomId];
                }
            }

            // Ctrl+Drag duplicates: the dragged instance is placed at the
            // drop target as a brand-new event, and the original is left
            // untouched at its original slot. Only relevant while actually
            // moving an event around, not resizing one in place.
            const isDuplicating = interaction === "move" && ctrlHeldRef.current;

            if (isDuplicating) {
                const {
                    id: _id,
                    locked: _locked,
                    hidden: _hidden,
                    fake: _fake,
                    ganttEventId: _ganttEventId,
                    ganttOccurrenceDate: _ganttOccurrenceDate,
                    ...rest
                } = changes.event;
                const duplicatedEvent = {
                    ...rest,
                    startTime: dayjs(changes.start),
                    endTime: dayjs(changes.end),
                    rooms: newRooms,
                } as Event;

                handleSaveEvent(duplicatedEvent, EventChangeInitiator.DragDrop);
                return;
            }

            const updatedEvent: Event = {
                ...changes.event,
                startTime: dayjs(changes.start),
                endTime: dayjs(changes.end),
                rooms: newRooms,
            };

            handleSaveEvent(
                updatedEvent,
                interaction === "resize"
                    ? EventChangeInitiator.Resize
                    : EventChangeInitiator.DragDrop,
            );
        },
        [handleSaveEvent],
    );

    const handleSlotSelect = useCallback(
        (slotInfo: SlotInfo): void => {
            setSelectedSlotInfo({
                start: slotInfo.start,
                resourceId: slotInfo.resourceId,
            });
            setActiveEvent(null);

            if (slotInfo.action === "click") return;

            const roomId: null | ResolvableRoom = slotInfo.resourceId
                ? resourceKeyToResolvable(slotInfo.resourceId.toString())
                : null;

            const newRooms =
                roomId && roomId.id !== DUMMY_ROOM_ID ? [roomId] : [];

            const newEvent = {
                startTime: dayjs(slotInfo.start),
                endTime: dayjs(slotInfo.end),
                rooms: newRooms,
                instructors: filteredInstructors,
                courses: filteredCourses,
            };

            setSelectedEvent(newEvent);
            setOpenEventDialog(true);
        },
        [
            setSelectedEvent,
            setOpenEventDialog,
            filteredInstructors,
            filteredCourses,
        ],
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            // These shortcuts act on the calendar, so they must stay out of the
            // way of anything the user is actually typing into — including
            // rich-text hosts and MUI's Autocomplete/Select listboxes — and out
            // of any open dialog, where Delete and Ctrl+V belong to the form on
            // screen rather than to the events behind it.
            const target = e.target as HTMLElement | null;
            if (
                !target ||
                ["INPUT", "TEXTAREA"].includes(target.tagName) ||
                target.isContentEditable ||
                target.closest(
                    '[contenteditable="true"], [role="combobox"], [role="listbox"], [role="textbox"], .MuiInputBase-root',
                ) !== null ||
                document.querySelector('.MuiDialog-root, [role="dialog"]') !==
                    null
            )
                return;

            const {
                activeEvent: currentActive,
                copiedEvent: currentCopied,
                selectedSlotInfo: currentSlot,
            } = copyPasteData.current;
            const isCmdOrCtrl = e.ctrlKey || e.metaKey;

            if (e.key === "Delete" && currentActive?.id) {
                handleDeleteEvent(
                    currentActive.id,
                    EventChangeInitiator.Keyboard,
                );
            }

            if (isCmdOrCtrl && e.key === "c" && currentActive) {
                setCopiedEvent(currentActive);
            }

            if (isCmdOrCtrl && e.key === "x" && currentActive) {
                setCopiedEvent(currentActive);
                handleDeleteEvent(
                    currentActive.id,
                    EventChangeInitiator.CopyPaste,
                );
                setActiveEvent(null);
            }

            if (isCmdOrCtrl && e.key === "v" && currentCopied) {
                e.preventDefault();
                const originalStart = dayjs(currentCopied.startTime);
                const originalEnd = dayjs(currentCopied.endTime);
                const duration = originalEnd.diff(originalStart, "minute");

                let newStart = currentSlot
                    ? dayjs(currentSlot.start)
                    : originalStart.add(30, "minute");
                let newEnd = newStart.add(duration, "minute");

                let newRooms = currentCopied.rooms;
                if (currentSlot?.resourceId) {
                    const parsedRoomId = resourceKeyToResolvable(
                        currentSlot.resourceId.toString(),
                    );
                    newRooms =
                        parsedRoomId.id === DUMMY_ROOM_ID ? [] : [parsedRoomId];
                }

                // Strip id plus everything that identifies the *source*
                // event rather than the pasted copy: locked/hidden/fake
                // are per-event display state, and ganttEventId/
                // ganttOccurrenceDate are gantt-cut provenance (see
                // EventFactory.ts's invariant) — carrying them over would
                // make the paste masquerade as the original event.
                const {
                    id: _id,
                    locked: _locked,
                    hidden: _hidden,
                    fake: _fake,
                    ganttEventId: _ganttEventId,
                    ganttOccurrenceDate: _ganttOccurrenceDate,
                    ...rest
                } = currentCopied;
                const newEvent = {
                    ...rest,
                    startTime: newStart, // Keep Dayjs objects to align with the Event type signature
                    endTime: newEnd, // Keep Dayjs objects to align with the Event type signature
                    rooms: newRooms,
                } as Event;

                handleSaveEvent(newEvent, EventChangeInitiator.CopyPaste);
                setActiveEvent(newEvent);
                setSelectedSlotInfo(null);
            }
        },
        [handleSaveEvent, handleDeleteEvent],
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    return {
        handleEventDrag,
        handleSlotSelect,
        setActiveEvent,
        activeEvent,
    };
}
